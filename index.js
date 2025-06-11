const express = require('express');
const axios = require('axios');
const yaml = require('js-yaml');
const app = express();

// 固定配置，可以是 YAML、Clash JSON 或 SingBox JSON
const FIXED_CONFIG_URL = 'https://raw.githubusercontent.com/6otho/singbox-Peizhi/refs/heads/main/singbox1.11.json';

async function loadConfig(url) {
  const res = await axios.get(url, { headers: { 'User-Agent': 'Config Merger' }, responseType: 'text' });
  const data = res.data;
  try { return JSON.parse(data); } catch { return yaml.load(data); }
}

// 将 Clash 代理对象转换为 SingBox 出站配置
function clashToSingboxOutbound(proxy) {
  return {
    tag: proxy.name,
    type: proxy.type === 'ss' ? 'shadowsocks' : proxy.type,
    server: proxy.server,
    port: proxy.port,
    cipher: proxy.cipher,
    password: proxy.password,
    udp: true
  };
}

app.get('/', async (req, res) => {
  const subUrl = req.query.url;
  if (!subUrl) return res.status(400).send('请提供订阅链接，例如 ?url=你的订阅地址');

  try {
    const fixedConfig = await loadConfig(FIXED_CONFIG_URL);
    const isSingboxJson = Array.isArray(fixedConfig.outbounds);

    // 原始模板代理列表（Clash proxies 或 SingBox outbounds）
    let templateProxies = isSingboxJson
      ? fixedConfig.outbounds.filter(o => o.tag && ['shadowsocks','vmess','trojan','http','socks'].includes(o.type)).map(o => ({ name: o.tag, type: o.type, server: o.server, port: o.port, cipher: o.cipher, password: o.password }))
      : Array.isArray(fixedConfig.proxies) ? [...fixedConfig.proxies] : [];

    // 获取订阅并解码
    let raw = (await axios.get(subUrl, { headers: { 'User-Agent': 'Config Merger' }, responseType: 'text' })).data;
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      if (/^\s*(\{|\[|proxies:)/.test(decoded)) raw = decoded;
    } catch {}

    // 解析订阅内容
    let subConfig;
    if (/proxies:|^---/.test(raw)) subConfig = yaml.load(raw);
    else {
      try { subConfig = JSON.parse(raw); }
      catch {
        subConfig = { proxies: raw.split('\n').filter(Boolean).map(line => {
          const parts = line.split('|');
          return parts.length >= 5 ? { name: `${parts[1]}-${parts[2]}`, type: parts[0], server: parts[1], port: +parts[2], cipher: parts[3], password: parts[4] } : null;
        }).filter(Boolean) };
      }
    }
    const subProxies = Array.isArray(subConfig.proxies) ? subConfig.proxies : [];

    if (subProxies.length) {
      // 合并并去重
      const combined = [...templateProxies];
      // 替换首条
      Object.assign(combined[0] || {}, subProxies[0]);
      combined.push(...subProxies);
      const seen = new Set();
      const mergedClash = combined.filter(p => p.name && !seen.has(p.name) && seen.add(p.name));

      if (isSingboxJson) {
        // 构建 tag->outbound map
        const map = new Map(fixedConfig.outbounds.map(o => [o.tag, o]));
        // 更新或添加节点
        mergedClash.forEach(p => {
          const ob = clashToSingboxOutbound(p);
          if (map.has(ob.tag)) {
            Object.assign(map.get(ob.tag), ob);
          } else {
            map.set(ob.tag, ob);
          }
        });
        fixedConfig.outbounds = Array.from(map.values());
      } else {
        fixedConfig.proxies = mergedClash;
        if (Array.isArray(fixedConfig['proxy-groups'])) {
          fixedConfig['proxy-groups'] = fixedConfig['proxy-groups'].map(group => {
            if (group.name === 'PROXY' && Array.isArray(group.proxies)) {
              group.proxies = group.proxies.filter(n => mergedClash.some(p => p.name === n));
            }
            return group;
          });
        }
      }
    }

    const isJsonOutput = FIXED_CONFIG_URL.endsWith('.json') || subUrl.endsWith('.json');
    const outData = isJsonOutput ? JSON.stringify(fixedConfig, null, 2) : yaml.dump(fixedConfig);
    res.set('Content-Type', isJsonOutput ? 'application/json' : 'text/yaml');
    res.send(outData);
  } catch (err) {
    res.status(500).send(`转换失败：${err.message}`);
  }
});

module.exports = app;
