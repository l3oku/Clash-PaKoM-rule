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
    return JSON.parse(data);
  } catch {
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

    // Base64 解码尝试
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      if (decoded.includes('proxies:') || decoded.trim().startsWith('[') || decoded.trim().startsWith('{')) {
        raw = decoded;
      }
    } catch {}

    // 订阅解析
    let subConfig;
    if (raw.includes('proxies:') || raw.trim().startsWith('---')) {
      subConfig = yaml.load(raw);
    } else {
      try {
        subConfig = JSON.parse(raw);
      } catch {
        subConfig = {
          proxies: raw.split('\n').filter(Boolean).map(line => {
            const parts = line.split('|');
            if (parts.length < 5) return null;
            return {
              name: `${parts[1]}-${parts[2]}`,
              type: parts[0],
              server: parts[1],
              port: +parts[2],
              cipher: parts[3],
              password: parts[4]
            };
          }).filter(Boolean)
        };
      }
    }

    // 合并逻辑
    if (Array.isArray(subConfig.proxies) && subConfig.proxies.length) {
      const templateProxies = [...fixedConfig.proxies];
      // 替换模板第一个节点
      if (templateProxies[0]) {
        Object.assign(templateProxies[0], subConfig.proxies[0]);
      }
      // 合并并去重
      const combined = [...templateProxies, ...subConfig.proxies];
      const seen = new Set();
      fixedConfig.proxies = combined.filter(p => p.name && !seen.has(p.name) && seen.add(p.name));

      // 更新 proxy-groups
      if (Array.isArray(fixedConfig['proxy-groups'])) {
        fixedConfig['proxy-groups'] = fixedConfig['proxy-groups'].map(group => {
          if (group.name === 'PROXY' && Array.isArray(group.proxies)) {
            group.proxies = group.proxies.filter(name => fixedConfig.proxies.some(p => p.name === name));
          }
          return group;
        });
      }
    }

    // 根据 FIXED_CONFIG_URL 或 请求参数判断输出格式
    const isJsonOutput = FIXED_CONFIG_URL.endsWith('.json') || subUrl.endsWith('.json');
    const output = isJsonOutput
      ? JSON.stringify(fixedConfig, null, 2)
      : yaml.dump(fixedConfig);

    res.set('Content-Type', isJsonOutput ? 'application/json' : 'text/yaml');
    res.send(output);
  } catch (err) {
    res.status(500).send(`转换失败：${err.message}`);
  }
});

module.exports = app;
