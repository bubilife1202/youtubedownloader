const ytdl = require('@distube/ytdl-core');
const { Agent } = require('undici');

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

// ytdl-core 에이전트 생성 (IPv6 차단 우회)
const agent = ytdl.createAgent(undefined, {
  localAddress: undefined
});

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

    // 비디오 정보 가져오기 (강화된 옵션)
    const info = await ytdl.getInfo(videoUrl, {
      agent: agent,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-Dest': 'document'
        }
      },
      // OAuth를 사용하지 않고 우회
      lang: 'en',
      // 추가 옵션
      includeRelatedVideo: false,
      includePlayerResponse: true
    });

    console.log('Video info fetched successfully');
    console.log('Video title:', info.videoDetails.title);
    console.log('Total formats available:', info.formats?.length || 0);

    // 비디오 제목
    const title = info.videoDetails.title;

    // 포맷 정보 추출 (비디오+오디오, 비디오만, 오디오만)
    const formats = info.formats
      .filter(format => {
        // 다운로드 가능한 URL이 있는 포맷만 필터링
        return format.url && (format.hasVideo || format.hasAudio);
      })
      .map(format => {
        return {
          itag: format.itag,
          quality: format.qualityLabel || format.audioQuality || 'unknown',
          container: format.container,
          hasVideo: format.hasVideo || false,
          hasAudio: format.hasAudio || false,
          contentLength: format.contentLength,
          url: format.url,
          mimeType: format.mimeType,
          bitrate: format.bitrate,
          // 파일 크기 (MB)
          fileSize: format.contentLength
            ? (parseInt(format.contentLength) / (1024 * 1024)).toFixed(2) + ' MB'
            : 'Unknown'
        };
      })
      .sort((a, b) => {
        // 비디오+오디오가 있는 것을 우선, 그 다음 화질 순
        if (a.hasVideo && a.hasAudio && !(b.hasVideo && b.hasAudio)) return -1;
        if (!(a.hasVideo && a.hasAudio) && b.hasVideo && b.hasAudio) return 1;
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        title,
        thumbnail: info.videoDetails.thumbnails?.[0]?.url || '',
        author: info.videoDetails.author?.name || '',
        lengthSeconds: info.videoDetails.lengthSeconds,
        viewCount: info.videoDetails.viewCount,
        recommendedFormat,
        formats
      })
    };

  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // 더 구체적인 에러 메시지 제공
    let errorMessage = '비디오 정보를 가져오는 중 오류가 발생했습니다.';
    let statusCode = 500;

    const errMsg = error.message.toLowerCase();

    if (errMsg.includes('video unavailable') || errMsg.includes('not found')) {
      errorMessage = '이 비디오는 현재 사용할 수 없습니다. (비공개 또는 삭제됨)';
      statusCode = 404;
    } else if (errMsg.includes('age') || errMsg.includes('restricted')) {
      errorMessage = '연령 제한이 있는 비디오는 다운로드할 수 없습니다.';
      statusCode = 403;
    } else if (errMsg.includes('private')) {
      errorMessage = '비공개 비디오는 다운로드할 수 없습니다.';
      statusCode = 403;
    } else if (errMsg.includes('copyright')) {
      errorMessage = '저작권 문제로 이 비디오를 처리할 수 없습니다.';
      statusCode = 403;
    } else if (errMsg.includes('sign in') || errMsg.includes('login') || errMsg.includes('confirm your age')) {
      errorMessage = 'YouTube 접근 제한이 있습니다. 다른 비디오를 시도해주세요.';
      statusCode = 403;
    } else if (errMsg.includes('status code 429') || errMsg.includes('too many requests')) {
      errorMessage = '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
      statusCode = 429;
    } else if (errMsg.includes('status code 403') || errMsg.includes('forbidden')) {
      errorMessage = 'YouTube에서 접근을 차단했습니다. 잠시 후 다시 시도해주세요.';
      statusCode = 403;
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
