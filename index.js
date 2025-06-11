const express = require('express');
const axios = require('axios');
const yaml = require('js-yaml');
const app = express();

const FIXED_YAML_URL = 'https://gh.ikuu.eu.org/https://raw.githubusercontent.com/6otho/Yaml-PaKo/refs/heads/main/PAKO_urltest.yaml';
const FIXED_JSON_URL  = 'https://raw.githubusercontent.com/6otho/singbox-Peizhi/refs/heads/main/singbox1.11.json';

// 通用加载函数，自动识别 YAML / JSON
async function loadConfig(url) {
  const res = await axios.get(url, { headers: { 'User-Agent': 'Clash Verge' } });
  const ct = res.headers['content-type'] || '';
  if (url.endsWith('.json') || ct.includes('application/json')) {
    return res.data;               // 直接返回 JSON 对象
  } else {
    return yaml.load(res.data);    // 解析 YAML
  }
}

app.get('/', async (req, res) => {
  const subUrl = req.query.url;
  if (!subUrl) return res.status(400).send('请提供订阅链接，例如 ?url=你的订阅地址');

  try {
    // 1. 先加载 YAML 模板
    const fixedYaml = await loadConfig(FIXED_YAML_URL);
    // 2. 再加载 SingBox JSON 模板
    const fixedJson = await loadConfig(FIXED_JSON_URL);

    // 你可以选择优先使用 JSON 模板，或把 JSON 也合并到 YAML 模板里。
    // 下面示例：以 JSON 为基础，注入 YAML 里没有的部分。
    const fixedConfig = { 
      ...fixedJson, 
      // 如果 JSON 里没有 proxies，就用 YAML 的
      proxies: Array.isArray(fixedJson.proxies) ? fixedJson.proxies : (Array.isArray(fixedYaml.proxies) ? fixedYaml.proxies : [])
      // 你也可以把两者合并：proxies: [...(fixedYaml.proxies||[]), ...(fixedJson.proxies||[])]
    };

    // 以下部分保持不变：拉取订阅、解码、解析为 subConfig.proxies 数组……
    const response = await axios.get(subUrl, { headers: { 'User-Agent': 'Clash Verge' } });
    let decodedData = response.data;
    try {
      const tmp = Buffer.from(decodedData, 'base64').toString('utf-8');
      if (tmp.includes('proxies:') || tmp.includes('port:')) decodedData = tmp;
    } catch (e) {}

    let subConfig;
    if (decodedData.includes('proxies:')) {
      subConfig = yaml.load(decodedData);
    } else {
      subConfig = {
        proxies: decodedData.split('\n').filter(l => l.trim()).map(line => {
          const p = line.split('|');
          return p.length>=5 ? {
            name: `${p[1]}-${p[2]}`, type: p[0]||'ss',
            server: p[1], port: +p[2],
            cipher: p[3]||'aes-256-gcm', password: p[4]
          } : null;
        }).filter(Boolean)
      };
    }

    // 接下来同你原逻辑：替换第一个 proxy，合并、去重、更新 proxy-groups……
    if (subConfig.proxies.length) {
      const tplProxies = [...fixedConfig.proxies];
      // 替换逻辑
      const sp = subConfig.proxies[0];
      if (tplProxies.length) {
        tplProxies[0] = { ...tplProxies[0], server: sp.server, port: sp.port, password: sp.password, cipher: sp.cipher, type: sp.type };
      }
      const merged = [...tplProxies, ...subConfig.proxies];
      const seen = new Set();
      fixedConfig.proxies = merged.filter(p => p.name && !seen.has(p.name) && seen.add(p.name));
      // 更新 proxy-groups
      if (Array.isArray(fixedConfig['proxy-groups'])) {
        fixedConfig['proxy-groups'] = fixedConfig['proxy-groups'].map(g => {
          if (g.name === 'PROXY' && Array.isArray(g.proxies)) {
            return { ...g, proxies: g.proxies.filter(n => fixedConfig.proxies.some(p=>p.name===n)) };
          }
          return g;
        });
      }
    }

    res.set('Content-Type', 'text/yaml');
    res.send(yaml.dump(fixedConfig));
  } catch (err) {
    res.status(500).send(`转换失败：${err.message}`);
  }
});

module.exports = app;
