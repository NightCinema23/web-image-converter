// 팝업 UI 요소 참조
const formatRadios = document.querySelectorAll('input[name="format"]');
const qualitySlider = document.getElementById('quality-slider');
const qualityValue = document.getElementById('quality-value');
const qualitySection = document.getElementById('quality-section');
const saveStatus = document.getElementById('save-status');

let saveTimer;

// 설정이 저장됐을 때 "저장됨" 텍스트를 잠깐 표시
function showSaved() {
  saveStatus.textContent = '저장됨';
  saveStatus.classList.add('visible');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveStatus.classList.remove('visible'), 1500);
}

// 포맷 또는 품질이 변경될 때 chrome.storage.sync에 즉시 저장
function saveSettings() {
  const format = document.querySelector('input[name="format"]:checked')?.value ?? 'png';
  const quality = parseInt(qualitySlider.value, 10) / 100; // 슬라이더값(50~100) → 소수(0.5~1.0)
  chrome.storage.sync.set({ format, quality }, showSaved);

  // PNG 선택 시 품질 슬라이더를 비활성화 상태로 표시 (JPG 전용 옵션)
  const hasQuality = format === 'jpg';
  qualitySection.style.opacity = hasQuality ? '1' : '0.4';
  qualitySection.style.pointerEvents = hasQuality ? 'auto' : 'none';
}

// 포맷 라디오 버튼 변경 감지
formatRadios.forEach((r) => r.addEventListener('change', saveSettings));

// 슬라이더 드래그 중 퍼센트 숫자 실시간 업데이트
qualitySlider.addEventListener('input', () => {
  qualityValue.textContent = `${qualitySlider.value}%`;
});

// 슬라이더에서 손을 뗄 때 저장
qualitySlider.addEventListener('change', saveSettings);

// 팝업이 열릴 때 chrome.storage.sync에서 저장된 설정을 불러와 UI에 반영
chrome.storage.sync.get({ format: 'png', quality: 1.0 }, ({ format, quality }) => {
  // 저장된 포맷에 맞는 라디오 버튼 선택
  const radio = document.querySelector(`input[name="format"][value="${format}"]`);
  if (radio) radio.checked = true;

  // 저장된 품질값(소수)을 퍼센트로 변환해 슬라이더에 반영
  const pct = Math.round(quality * 100);
  qualitySlider.value = pct;
  qualityValue.textContent = `${pct}%`;

  // PNG 선택 상태이면 품질 슬라이더 비활성화
  const hasQuality = format === 'jpg';
  qualitySection.style.opacity = hasQuality ? '1' : '0.4';
  qualitySection.style.pointerEvents = hasQuality ? 'auto' : 'none';
});
