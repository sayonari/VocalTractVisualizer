import './components/vocal-tract-app';
import './components/debug-info';
import './styles/main.css';
import { checkMemoryUsage } from './utils/system-check';

// グローバルエラーハンドリング
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// システム情報を表示
checkMemoryUsage();

// ブラウザ互換性チェック
const checkBrowserCompatibility = () => {
  const features = {
    'Web Audio API': 'AudioContext' in window || 'webkitAudioContext' in window,
    'getUserMedia': navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
    'Web Components': 'customElements' in window,
    'WebGL': (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && 
          (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      } catch(e) {
        return false;
      }
    })()
  };

  const incompatibleFeatures = Object.entries(features)
    .filter(([, supported]) => !supported)
    .map(([feature]) => feature);

  if (incompatibleFeatures.length > 0) {
    console.warn('以下の機能がサポートされていません:', incompatibleFeatures);
  }

  return incompatibleFeatures.length === 0;
};

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
  if (checkBrowserCompatibility()) {
    console.log('Vocal Tract Visualizer initialized');
  } else {
    console.error('お使いのブラウザは一部の機能をサポートしていません');
  }
});