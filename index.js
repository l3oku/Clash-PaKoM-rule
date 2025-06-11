const express = require('express');
const axios = require('axios');
const yaml = require('js-yaml');
const app = express();

// 固定配置，可以是 YAML、Clash JSON 或 SingBox JSON
const FIXED_CONFIG_URL = 'https://raw.githubusercontent.com/6otho/singbox-Peizhi/refs/heads/main/singbox1.11.json';

async function loadConfig(url) {
  const res = await axios.get(url, { headers: { 'User-Agent': 'Config Merger' }, responseType: 'text' });
  const data = res.data;
  try {
    return JSON.parse(data);
  } catch {
    return yaml.load(data);
  }
}

app.get('/', async (req, res) => {
  const subUrl = req.query.url;
  if (!subUrl) return res.status(400).send('请提供订阅链接，例如 ?url=你的订阅地址');

  try {
    const fixedConfig = await loadConfig(FIXED_CONFIG_URL);
    // 检测是否 SingBox JSON
    const isSingboxJson = Array.isArray(fixedConfig.outbounds);
    // Clash 结构代理数组
    let templateProxies = isSingboxJson
      ? [...fixedConfig.outbounds]
      : Array.isArray(fixedConfig.proxies)
        ? [...fixedConfig.proxies]
        : [];

    // 加载订阅原始数据
    const subRes = await axios.get(subUrl, { headers: { 'User-Agent': 'Config Merger' }, responseType: 'text' });
    let raw = subRes.data;

    // 尝试 Base64 解码
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      if (decoded.includes('proxies:') || decoded.trim().startsWith('{') || decoded.trim().startsWith('[')) {
        raw = decoded;
      }
    } catch {}

    // 解析订阅
    let subConfig;
    if (raw.includes('proxies:') || raw.trim().startsWith('---')) {
      subConfig = yaml.load(raw);
    } else {
      try {
        subConfig = JSON.parse(raw);
      } catch {
        subConfig = {
          proxies: raw.split('\n').filter(l => l).map(line => {
            const parts = line.split('|');
            if (parts.length < 5) return null;
            return { name: `${parts[1]}-${parts[2]}`, type: parts[0], server: parts[1], port: +parts[2], cipher: parts[3], password: parts[4] };
          }).filter(Boolean)
        };
      }
    }

    // 合并逻辑
    const subProxies = Array.isArray(subConfig.proxies) ? subConfig.proxies : [];
    if (subProxies.length) {
      // 替换首条
      if (templateProxies.length) {
        Object.assign(templateProxies[0], subProxies[0]);
      }
      // 合并并去重
      const combined = [...templateProxies, ...subProxies];
      const seen = new Set();
      const merged = combined.filter(p => p.name && !seen.has(p.name) && seen.add(p.name));
      // 回写
      if (isSingboxJson) {
        fixedConfig.outbounds = merged;
      } else {
        fixedConfig.proxies = merged;
        // 更新 proxy-groups
        if (Array.isArray(fixedConfig['proxy-groups'])) {
          fixedConfig['proxy-groups'] = fixedConfig['proxy-groups'].map(group => {
            if (group.name === 'PROXY' && Array.isArray(group.proxies)) {
              group.proxies = group.proxies.filter(n => merged.some(p => p.name === n));
            }
            return group;
          });
        }
      }
    }

    // 输出格式
    const isJsonOutput = FIXED_CONFIG_URL.endsWith('.json') || subUrl.endsWith('.json');
    const outData = isJsonOutput
      ? JSON.stringify(fixedConfig, null, 2)
      : yaml.dump(fixedConfig);
    res.set('Content-Type', isJsonOutput ? 'application/json' : 'text/yaml');
    res.send(outData);
  } catch (err) {
    res.status(500).send(`转换失败：${err.message}`);
  }
});

module.exports = app;
