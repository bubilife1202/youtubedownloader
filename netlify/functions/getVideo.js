const youtubedl = require('youtube-dl-exec');

// YouTube Shorts URL을 일반 URL로 변환
function normalizeYouTubeUrl(url) {
  try {
    // Shorts URL 패턴: /shorts/VIDEO_ID
    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
    }
    return url;
  } catch (error) {
    return url;
  }
}

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // URL 파라미터에서 유튜브 URL 가져오기
    let videoUrl = event.queryStringParameters?.url;

    if (!videoUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL 파라미터가 필요합니다.' })
      };
    }

    // YouTube Shorts URL을 일반 URL로 변환
    videoUrl = normalizeYouTubeUrl(videoUrl);
    console.log('Normalized URL:', videoUrl);

    // 유튜브 URL 유효성 검사
    if (!ytdl.validateURL(videoUrl)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: '유효하지 않은 유튜브 URL입니다.',
          providedUrl: videoUrl
        })
      };
    }

    console.log('Fetching video info for:', videoUrl);

    // yt-dlp를 사용하여 비디오 정보 가져오기
    // -J: JSON 형식으로 출력
    // --no-warnings: 경고 메시지 숨기기
    // --no-call-home: 업데이트 체크 안함
    // --no-check-certificate: SSL 인증서 체크 안함 (일부 환경에서 필요)
    const info = await youtubedl(videoUrl, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      ]
    });

    console.log('Video info fetched successfully');
    console.log('Video title:', info.title);
    console.log('Total formats available:', info.formats?.length || 0);

    // 포맷 정보 추출
    const formats = (info.formats || [])
      .filter(format => {
        // URL이 있고, 비디오나 오디오가 있는 포맷만
        return format.url && (format.vcodec !== 'none' || format.acodec !== 'none');
      })
      .map(format => {
        const hasVideo = format.vcodec && format.vcodec !== 'none';
        const hasAudio = format.acodec && format.acodec !== 'none';

        return {
          itag: format.format_id,
          quality: format.format_note || format.quality || format.height ? `${format.height}p` : 'audio',
          container: format.ext,
          hasVideo: hasVideo,
          hasAudio: hasAudio,
          url: format.url,
          mimeType: format.format || '',
          bitrate: format.tbr || format.abr || format.vbr || 0,
          fileSize: format.filesize
            ? (format.filesize / (1024 * 1024)).toFixed(2) + ' MB'
            : (format.filesize_approx
                ? (format.filesize_approx / (1024 * 1024)).toFixed(2) + ' MB (approx)'
                : 'Unknown'),
          width: format.width,
          height: format.height,
          fps: format.fps
        };
      })
      .sort((a, b) => {
        // 비디오+오디오가 함께 있는 것을 우선
        if (a.hasVideo && a.hasAudio && !(b.hasVideo && b.hasAudio)) return -1;
        if (!(a.hasVideo && a.hasAudio) && b.hasVideo && b.hasAudio) return 1;
        // 화질 순
        if (a.height && b.height) return b.height - a.height;
        // 비트레이트 순
        return (b.bitrate || 0) - (a.bitrate || 0);
      });

    console.log('Filtered formats count:', formats.length);

    if (formats.length === 0) {
      console.warn('No downloadable formats found');
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: '다운로드 가능한 포맷을 찾을 수 없습니다.',
          details: '이 비디오는 현재 다운로드할 수 없습니다.'
        })
      };
    }

    // 추천 포맷 (비디오+오디오가 함께 있는 최고 화질)
    const recommendedFormat = formats.find(f => f.hasVideo && f.hasAudio);
    console.log('Recommended format:', recommendedFormat ? `${recommendedFormat.quality} (${recommendedFormat.container})` : 'none');

    // 썸네일 가져오기
    const thumbnail = info.thumbnail || (info.thumbnails && info.thumbnails.length > 0 ? info.thumbnails[info.thumbnails.length - 1].url : '');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        title: info.title || 'Unknown',
        thumbnail: thumbnail,
        author: info.uploader || info.channel || 'Unknown',
        lengthSeconds: info.duration || 0,
        viewCount: info.view_count || 0,
        recommendedFormat,
        formats
      })
    };

  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      stderr: error.stderr
    });

    // 더 구체적인 에러 메시지 제공
    let errorMessage = '비디오 정보를 가져오는 중 오류가 발생했습니다.';
    let statusCode = 500;

    const errMsg = (error.message + ' ' + (error.stderr || '')).toLowerCase();

    if (errMsg.includes('video unavailable') || errMsg.includes('not found') || errMsg.includes('this video is not available')) {
      errorMessage = '이 비디오는 현재 사용할 수 없습니다. (비공개 또는 삭제됨)';
      statusCode = 404;
    } else if (errMsg.includes('age') || errMsg.includes('restricted')) {
      errorMessage = '연령 제한이 있는 비디오입니다.';
      statusCode = 403;
    } else if (errMsg.includes('private')) {
      errorMessage = '비공개 비디오는 다운로드할 수 없습니다.';
      statusCode = 403;
    } else if (errMsg.includes('copyright') || errMsg.includes('blocked')) {
      errorMessage = '저작권 문제로 이 비디오를 처리할 수 없습니다.';
      statusCode = 403;
    } else if (errMsg.includes('sign in') || errMsg.includes('login') || errMsg.includes('confirm your age') || errMsg.includes('members-only')) {
      errorMessage = '이 비디오는 접근 제한이 있습니다. (로그인 필요 또는 멤버십 전용)';
      statusCode = 403;
    } else if (errMsg.includes('429') || errMsg.includes('too many requests')) {
      errorMessage = '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
      statusCode = 429;
    } else if (errMsg.includes('403') || errMsg.includes('forbidden')) {
      errorMessage = 'YouTube에서 일시적으로 접근을 차단했습니다. 잠시 후 다시 시도해주세요.';
      statusCode = 403;
    } else if (errMsg.includes('premieres in') || errMsg.includes('premiere')) {
      errorMessage = '이 비디오는 아직 공개되지 않았습니다. (프리미어 예정)';
      statusCode = 400;
    } else if (errMsg.includes('live event') || errMsg.includes('live stream')) {
      errorMessage = '라이브 스트리밍 비디오는 지원하지 않습니다.';
      statusCode = 400;
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
