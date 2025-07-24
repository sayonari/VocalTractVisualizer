export interface SystemInfo {
  memory?: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
  userAgent: string;
  platform: string;
  cores: number;
  deviceMemory?: number;
}

export function getSystemInfo(): SystemInfo {
  const info: SystemInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    cores: navigator.hardwareConcurrency || 1
  };

  // Chrome特有のメモリ情報
  if ('memory' in performance && (performance as any).memory) {
    const memory = (performance as any).memory;
    info.memory = {
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize
    };
  }

  // デバイスメモリ（実験的API）
  if ('deviceMemory' in navigator) {
    info.deviceMemory = (navigator as any).deviceMemory;
  }

  return info;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function checkMemoryUsage(): void {
  const info = getSystemInfo();
  
  if (info.memory) {
    const usagePercent = (info.memory.usedJSHeapSize / info.memory.jsHeapSizeLimit) * 100;
    
    console.log('=== メモリ使用状況 ===');
    console.log(`ヒープサイズ上限: ${formatBytes(info.memory.jsHeapSizeLimit)}`);
    console.log(`総ヒープサイズ: ${formatBytes(info.memory.totalJSHeapSize)}`);
    console.log(`使用中ヒープサイズ: ${formatBytes(info.memory.usedJSHeapSize)}`);
    console.log(`使用率: ${usagePercent.toFixed(1)}%`);
    
    if (usagePercent > 90) {
      console.warn('メモリ使用率が90%を超えています！');
    }
  }
  
  if (info.deviceMemory) {
    console.log(`デバイスメモリ: ${info.deviceMemory} GB`);
  }
  
  console.log(`CPUコア数: ${info.cores}`);
  console.log(`プラットフォーム: ${info.platform}`);
}