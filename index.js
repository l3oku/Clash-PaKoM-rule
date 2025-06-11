const express = require('express');
const axios = require('axios');
const yaml = require('js-yaml');
const app = express();

// 固定配置，可以是 YAML 或 JSON
const FIXED_CONFIG_URL = 'https://raw.githubusercontent.com/6otho/singbox-Peizhi/refs/heads/main/singbox1.11.json';

async function loadConfig(url) {
  const res = await axios.get(url, { headers: { 'User-Agent': 'Config Merger' }, responseType: 'text' });
  const data = res.data;

  // JSON 判断：尝试解析
  try {
    const json = JSON.parse(data);
    return json;
  } catch (e) {
    // 不是合法 JSON，则作为 YAML 处理
    return yaml.load(data);
  }
}

app.get('/', async (req, res) => {
  const subUrl = req.query.url;
  if (!subUrl) return res.status(400).send('请提供订阅链接，例如 ?url=你的订阅地址');

  try {
    // 加载固定配置（JSON or YAML）
    const fixedConfig = await loadConfig(FIXED_CONFIG_URL);
    if (!Array.isArray(fixedConfig.proxies)) fixedConfig.proxies = [];

    // 加载订阅
    const subRes = await axios.get(subUrl, { headers: { 'User-Agent': 'Config Merger' }, responseType: 'text' });
    let raw = subRes.data;

    // Base64 解码候选
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      if (decoded.includes('proxies:') || decoded.trim().startsWith('[') || decoded.trim().startsWith('{')) {
        raw = decoded;
      }
    } catch (_) {}

    // 订阅解析
    let subConfig;
    if (raw.includes('proxies:') || raw.trim().startsWith('---')) {
      subConfig = yaml.load(raw);
    } else {
      try {
        subConfig = JSON.parse(raw);
      } catch (_) {
        // 自定义纯文本处理
        subConfig = {
          proxies: raw.split('\n').filter(Boolean).map(line => {
            const parts = line.split('|');
            return parts.length >= 5 ? {
              name: `${parts[1]}-${parts[2]}`,
              type: parts[0], server: parts[1], port: +parts[2], cipher: parts[3], password: parts[4]
            } : null;
          }).filter(Boolean)
        };
      }
    }

    // 合并逻辑
    if (Array.isArray(subConfig.proxies) && subConfig.proxies.length) {
      const templateProxies = [...fixedConfig.proxies];
      // 替换第一个模板
      if (templateProxies[0]) {
        const p = subConfig.proxies[0];
        templateProxies[0] = { ...templateProxies[0], ...p };
      }
      // 合并并去重
      const all = [...templateProxies, ...subConfig.proxies];
      const seen = new Set();
      fixedConfig.proxies = all.filter(p => p.name && !seen.has(p.name) && seen.add(p.name));

      // 更新分组
      if (Array.isArray(fixedConfig['proxy-groups'])) {
        fixedConfig['proxy-groups'] = fixedConfig['proxy-groups'].map(g => {
          if (g.name === 'PROXY' && Array.isArray(g.proxies)) {
            g.proxies = g.proxies.filter(n => fixedConfig.proxies.some(p => p.name === n));
          }
          return g;
        });
      }
    }

    // 输出
    const out = url.endsWith('.json') || FIXED_CONFIG_URL.endsWith('.json')
      ? JSON.stringify(fixedConfig, null, 2)
      : yaml.dump(fixedConfig);

    res.set('Content-Type', url.endsWith('.json') || FIXED_CONFIG_URL.endsWith('.json') ? 'application/json' : 'text/yaml');
    res.send(out);
  } catch (err) {
    res.status(500).send(`转换失败：${err.message}`);
  }
});

module.exports = app;
