// index.js
const express = require('express');
const axios   = require('axios');
const yaml    = require('js-yaml');

const app = express();
const FIXED_CONFIG_URL = 'https://gh.ikuu.eu.org/https://raw.githubusercontent.com/6otho/Yaml-PaKo/refs/heads/main/PAKO_urltest-CaiSe.yaml';

async function loadYaml(url) {
  const { data } = await axios.get(url, { headers: { 'User-Agent': 'Clash Verge' } });
  return yaml.load(data);
}

/**
 * 根据订阅 URL 推断常见的流量 API 路径
 */
function inferTrafficApi(subUrl) {
  try {
    const u = new URL(subUrl);
    // V2Board: /api/v1/client/get?token=…
    if (u.pathname.includes('/client/get')) return subUrl;
    // SSRPanel V4: /api/v1/client/subscribe → /api/v1/client/usage
    if (u.pathname.includes('/client/subscribe')) {
      u.pathname = u.pathname.replace('/client/subscribe', '/client/usage');
      return u.toString();
    }
    // Sspanel V3: /user/api/subscribe? … → /user/getUserInfo?
    if (u.pathname.includes('/user/api/subscribe')) {
      u.pathname = u.pathname.replace('/user/api/subscribe', '/user/getUserInfo');
      return u.toString();
    }
  } catch (e) { /* ignore */ }
  return '';
}

async function fetchTrafficData(apiUrl) {
  if (!apiUrl) return {};
  try {
    const { data } = await axios.get(apiUrl, { timeout: 5000 });
    // 期望 data 是 [{ name, upload, download, total }, …]
    if (!Array.isArray(data)) return {};
    return data.reduce((m, it) => {
      if (it.name) m[it.name] = it;
      return m;
    }, {});
  } catch (err) {
    console.error('拉取流量失败:', err.message);
    return {};
  }
}

app.get('/', async (req, res) => {
  const subUrl = req.query.url;
  if (!subUrl) return res.status(400).send('请提供订阅链接，例如：?url=你的订阅地址');

  try {
    // 1. 加载模板
    const fixedConfig = await loadYaml(FIXED_CONFIG_URL);
    fixedConfig.proxies = Array.isArray(fixedConfig.proxies) ? fixedConfig.proxies : [];

    // 2. 拉取并解析订阅
    const resp = await axios.get(subUrl, { headers: { 'User-Agent': 'Clash Verge' }, timeout: 10000 });
    let body = resp.data;
    try {
      const dec = Buffer.from(body, 'base64').toString('utf8');
      if (/proxies:|proxy-groups:/.test(dec)) body = dec;
    } catch {}
    let subConfig = { proxies: [] };
    if (body.includes('proxies:')) {
      subConfig = yaml.load(body);
    } else {
      subConfig.proxies = body
        .split('\n').map(l => l.trim()).filter(Boolean)
        .map(line => {
          const p = line.split('|');
          if (p.length < 5) return null;
          return {
            name:   `${p[1]}-${p[2]}`,
            type:   p[0] || 'ss',
            server: p[1],
            port:   parseInt(p[2], 10) || 443,
            cipher: p[3] || 'aes-256-gcm',
            password: p[4]
          };
        }).filter(Boolean);
    }

    // 3. 合并：模板中“非订阅节点” + 订阅节点（同名以订阅为准）
    const subNames = new Set(subConfig.proxies.map(p => p.name));
    const merged = [
      ...fixedConfig.proxies.filter(p => !subNames.has(p.name)),
      ...subConfig.proxies
    ];

    // 4. 决定用哪个流量接口：先看 &api=…，再试推断
    let trafficApi = req.query.api || inferTrafficApi(subUrl);
    const trafficMap = await fetchTrafficData(trafficApi);
    merged.forEach(p => {
      const t = trafficMap[p.name];
      if (t) {
        p.upload   = t.upload;
        p.download = t.download;
        p.total    = t.total;
      }
    });

    // 5. 更新 template 对象并修正 proxy-groups
    fixedConfig.proxies = merged;
    if (Array.isArray(fixedConfig['proxy-groups'])) {
      const valid = new Set(merged.map(p => p.name));
      fixedConfig['proxy-groups'] = fixedConfig['proxy-groups'].map(g => ({
        ...g,
        proxies: Array.isArray(g.proxies)
          ? g.proxies.filter(n => valid.has(n))
          : g.proxies
      }));
    }

    // 6. 输出 YAML
    res.setHeader('Content-Type', 'text/yaml');
    return res.send(yaml.dump(fixedConfig, { lineWidth: -1 }));
  } catch (err) {
    console.error(err);
    return res.status(500).send(`转换失败：${err.message}`);
  }
});

module.exports = app;
