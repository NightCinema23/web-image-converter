// 컨텍스트 메뉴 항목 ID
const MENU_PNG = 'save-as-png';
const MENU_JPG = 'save-as-jpg';

// 확장 프로그램이 설치되거나 업데이트될 때 우클릭 메뉴를 등록
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_PNG,
    title: 'PNG로 저장',
    contexts: ['image'], // 이미지 위에서 우클릭할 때만 메뉴 표시
  });
  chrome.contextMenus.create({
    id: MENU_JPG,
    title: 'JPG로 저장',
    contexts: ['image'],
  });
});

// 우클릭 메뉴 클릭 이벤트 처리
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_PNG) {
    convertAndDownload(info.srcUrl, 'image/png', 'png');
  } else if (info.menuItemId === MENU_JPG) {
    convertAndDownload(info.srcUrl, 'image/jpeg', 'jpg');
  }
});

// 이미지를 가져와서 변환 후 다운로드하는 메인 함수
async function convertAndDownload(srcUrl, mimeType, ext) {
  try {
    // 원본 이미지 URL에서 blob 데이터를 가져옴
    const response = await fetch(srcUrl);
    if (!response.ok) throw new Error(`이미지 불러오기 실패: ${response.status}`);

    const blob = await response.blob();

    // blob을 브라우저가 처리할 수 있는 ImageBitmap 객체로 변환
    const imageBitmap = await createImageBitmap(blob);

    // Service Worker 환경에서는 DOM을 사용할 수 없으므로
    // OffscreenCanvas를 이용해 캔버스 작업 수행
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');

    if (mimeType === 'image/jpeg') {
      // JPG는 투명도(alpha)를 지원하지 않으므로 흰색 배경으로 먼저 채움
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 원본 이미지를 캔버스에 그림
    ctx.drawImage(imageBitmap, 0, 0);

    // 팝업에서 저장한 품질 설정값을 불러옴
    const { quality } = await getSettings();

    // 캔버스 내용을 지정한 포맷(PNG 또는 JPG)의 blob으로 변환
    const convertedBlob = await canvas.convertToBlob({
      type: mimeType,
      quality: mimeType === 'image/jpeg' ? quality : undefined, // PNG는 quality 옵션 불필요
    });

    // blob을 chrome.downloads API가 받을 수 있는 data URL(base64) 형식으로 변환
    const dataUrl = await blobToDataUrl(convertedBlob);

    // 원본 파일명에서 확장자만 교체 (예: photo.webp → photo.png)
    const filename = buildFilename(srcUrl, ext);

    chrome.downloads.download({ url: dataUrl, filename });
  } catch (err) {
    console.error('[WebP to Image] 변환 중 오류:', err);
  }
}

// Blob → Base64 data URL 변환
// Service Worker에서는 FileReader와 URL.createObjectURL 모두 사용 불가하므로
// ArrayBuffer를 거쳐 직접 base64 인코딩 수행
async function blobToDataUrl(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // 대용량 이미지에서 btoa 호출 시 스택 오버플로우가 발생하지 않도록
  // 8192바이트 단위로 나눠서 문자열로 변환
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }

  return `data:${blob.type};base64,${btoa(binary)}`;
}

// 원본 URL에서 파일명을 추출한 뒤 확장자를 교체하는 함수
function buildFilename(srcUrl, ext) {
  try {
    const url = new URL(srcUrl);
    const base = url.pathname.split('/').pop() || 'image'; // 경로 마지막 부분이 파일명
    const nameWithoutExt = base.replace(/\.[^.]+$/, '');   // 기존 확장자 제거
    return `${nameWithoutExt}.${ext}`;
  } catch {
    return `image.${ext}`; // URL 파싱 실패 시 기본 파일명 사용
  }
}

// chrome.storage.sync에서 사용자 설정(품질)을 불러오는 함수
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ quality: 0.92 }, resolve); // 기본값: 92%
  });
}
