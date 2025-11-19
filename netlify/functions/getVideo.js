const ytdl = require('@distube/ytdl-core');

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
    const videoUrl = event.queryStringParameters?.url;

    if (!videoUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL 파라미터가 필요합니다.' })
      };
    }

    // 유튜브 URL 유효성 검사
    if (!ytdl.validateURL(videoUrl)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '유효하지 않은 유튜브 URL입니다.' })
      };
    }

    // 비디오 정보 가져오기
    const info = await ytdl.getInfo(videoUrl);

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

    // 추천 포맷 (비디오+오디오가 함께 있는 최고 화질)
    const recommendedFormat = formats.find(f => f.hasVideo && f.hasAudio);

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
    console.error('Error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: '비디오 정보를 가져오는 중 오류가 발생했습니다.',
        details: error.message
      })
    };
  }
};
