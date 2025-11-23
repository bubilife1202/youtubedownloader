const { Innertube } = require('youtubei.js');

// YouTube 클라이언트 인스턴스 (싱글톤)
let youtube = null;

async function getYouTubeClient() {
  if (youtube) {
    return youtube;
  }

  console.log('Initializing YouTube client...');
  youtube = await Innertube.create({
    lang: 'en',
    location: 'US',
    retrieve_player: true
  });
  console.log('YouTube client initialized');

  return youtube;
}

// YouTube URL에서 비디오 ID 추출
function extractVideoId(url) {
  try {
    // Shorts URL 패턴: /shorts/VIDEO_ID
    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      return shortsMatch[1];
    }

    // 일반 URL에서 비디오 ID 추출
    const urlObj = new URL(url);

    // youtu.be/VIDEO_ID 형식
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.substring(1).split('?')[0];
    }

    // youtube.com/watch?v=VIDEO_ID 형식
    const videoId = urlObj.searchParams.get('v');
    if (videoId) {
      return videoId;
    }

    // 그냥 ID만 입력한 경우
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
        body: JSON.stringify({
          success: false,
          error: 'URL 파라미터가 필요합니다.'
        })
      };
    }

    // 비디오 ID 추출
    const videoId = extractVideoId(videoUrl);
    console.log('Video ID:', videoId);

    // YouTube 클라이언트 가져오기
    const yt = await getYouTubeClient();

    // 비디오 정보 가져오기
    console.log('Fetching video info...');
    const info = await yt.getInfo(videoId);

    console.log('Video info fetched successfully');
    console.log('Video title:', info.basic_info.title);

    // 다운로드 가능한 포맷 가져오기
    const downloadOptions = await info.download();

    console.log('Download options retrieved');

    // 포맷 정보 추출
    const formats = [];

    // 모든 포맷 옵션 확인
    if (downloadOptions) {
      // video+audio 포맷
      if (downloadOptions.video_details) {
        const videoFormats = downloadOptions.video_details;
        for (const format of videoFormats) {
          if (format.url) {
            formats.push({
              itag: format.itag || 'unknown',
              quality: format.quality_label || format.quality || 'unknown',
              container: format.mime_type?.split(';')[0]?.split('/')[1] || 'mp4',
              hasVideo: true,
              hasAudio: true,
              url: format.url,
              mimeType: format.mime_type || '',
              bitrate: format.bitrate || 0,
              fileSize: format.content_length
                ? (parseInt(format.content_length) / (1024 * 1024)).toFixed(2) + ' MB'
                : 'Unknown',
              width: format.width,
              height: format.height,
              fps: format.fps
            });
          }
        }
      }

      // 비디오 전용 포맷
      if (downloadOptions.video) {
        for (const format of downloadOptions.video) {
          if (format.url) {
            formats.push({
              itag: format.itag || 'unknown',
              quality: format.quality_label || format.quality || 'video',
              container: format.mime_type?.split(';')[0]?.split('/')[1] || 'mp4',
              hasVideo: true,
              hasAudio: false,
              url: format.url,
              mimeType: format.mime_type || '',
              bitrate: format.bitrate || 0,
              fileSize: format.content_length
                ? (parseInt(format.content_length) / (1024 * 1024)).toFixed(2) + ' MB'
                : 'Unknown',
              width: format.width,
              height: format.height,
              fps: format.fps
            });
          }
        }
      }

      // 오디오 전용 포맷
      if (downloadOptions.audio) {
        for (const format of downloadOptions.audio) {
          if (format.url) {
            formats.push({
              itag: format.itag || 'unknown',
              quality: 'audio',
              container: format.mime_type?.split(';')[0]?.split('/')[1] || 'mp4',
              hasVideo: false,
              hasAudio: true,
              url: format.url,
              mimeType: format.mime_type || '',
              bitrate: format.bitrate || 0,
              fileSize: format.content_length
                ? (parseInt(format.content_length) / (1024 * 1024)).toFixed(2) + ' MB'
                : 'Unknown'
            });
          }
        }
      }
    }

    console.log('Total formats found:', formats.length);

    if (formats.length === 0) {
      console.error('No formats available');
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

    // 포맷 정렬 (비디오+오디오 우선, 그 다음 화질 순)
    formats.sort((a, b) => {
      if (a.hasVideo && a.hasAudio && !(b.hasVideo && b.hasAudio)) return -1;
      if (!(a.hasVideo && a.hasAudio) && b.hasVideo && b.hasAudio) return 1;
      if (a.height && b.height) return b.height - a.height;
      return (b.bitrate || 0) - (a.bitrate || 0);
    });

    // 추천 포맷 (비디오+오디오가 함께 있는 최고 화질)
    const recommendedFormat = formats.find(f => f.hasVideo && f.hasAudio);
    console.log('Recommended format:', recommendedFormat ? `${recommendedFormat.quality}` : 'none');

    // 썸네일 가져오기
    const thumbnails = info.basic_info.thumbnail;
    const thumbnail = thumbnails?.[thumbnails.length - 1]?.url || '';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        title: info.basic_info.title || 'Unknown',
        thumbnail: thumbnail,
        author: info.basic_info.author || 'Unknown',
        lengthSeconds: info.basic_info.duration || 0,
        viewCount: info.basic_info.view_count || 0,
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
    } else if (errMsg.includes('members') || errMsg.includes('membership')) {
      errorMessage = '멤버십 전용 비디오는 다운로드할 수 없습니다.';
      statusCode = 403;
    } else if (errMsg.includes('premieres') || errMsg.includes('premiere')) {
      errorMessage = '이 비디오는 아직 공개되지 않았습니다. (프리미어 예정)';
      statusCode = 400;
    } else if (errMsg.includes('live')) {
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
