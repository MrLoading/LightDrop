import os from 'os';
import { NetworkIpInfo } from '../../shared/types.js';

/**
 * 智能获取当前主机在局域网中的最佳 IPv4 地址
 */
export function getLocalIpAddress(): string {
  const allIps = getAllNetworkIps();
  const defaultItem = allIps.find((item) => item.isDefault);
  return defaultItem ? defaultItem.ip : '127.0.0.1';
}

/**
 * 获取当前设备所有非回环真实 IPv4 地址列表
 */
export function getAllNetworkIps(port: number = 8080, protocol: string = 'http'): NetworkIpInfo[] {
  const interfaces = os.networkInterfaces();
  const candidates: { name: string; ip: string; priority: number }[] = [];
  const seenIps = new Set<string>();

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    // 忽略特定纯内部或本地虚拟接口
    if (
      lowerName.includes('docker') ||
      lowerName.includes('veth') ||
      lowerName.includes('vmnet') ||
      lowerName.includes('virtual') ||
      lowerName.includes('utun') ||
      lowerName.includes('tun') ||
      lowerName.includes('tap')
    ) {
      continue;
    }

    const ifaceList = interfaces[name];
    if (!ifaceList) continue;

    for (const iface of ifaceList) {
      // 只要非回环的 IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address;
        if (ip === '127.0.0.1' || ip === '0.0.0.0' || seenIps.has(ip)) {
          continue;
        }
        seenIps.add(ip);

        let priority = 1;
        // 局域网常见网段优先级：192.168.x > 10.x > 172.16-31.x
        if (ip.startsWith('192.168.')) {
          priority = 4;
        } else if (ip.startsWith('10.')) {
          priority = 3;
        } else if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
          priority = 2;
        }

        // 如果网卡名类似 en0, eth0, wlan0，提升优先级
        if (/^(en0|eth0|wlan0)$/i.test(name)) {
          priority += 0.5;
        }

        candidates.push({ name, ip, priority });
      }
    }
  }

  // 按优先级降序排序
  candidates.sort((a, b) => b.priority - a.priority);

  if (candidates.length === 0) {
    return [
      {
        name: 'localhost',
        ip: '127.0.0.1',
        url: `${protocol}://127.0.0.1:${port}`,
        isDefault: true,
      },
    ];
  }

  return candidates.map((item, index) => ({
    name: item.name,
    ip: item.ip,
    url: `${protocol}://${item.ip}:${port}`,
    isDefault: index === 0,
  }));
}
