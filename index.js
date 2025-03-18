const express = require('express');
const axios = require('axios');
const yaml = require('js-yaml');
const app = express();

const FIXED_CONFIG_URL = 'https://raw.githubusercontent.com/l3oku/clashrule-lucy/refs/heads/main/Mihomo.yaml';

async function loadYaml(url) {
  const response = await axios.get(url, { headers: { 'User-Agent': 'Clash Verge' } });
  return yaml.load(response.data);
}

app.get('/', async (req, res) => {
  const subUrl = req.query.url;
  if (!subUrl) return res.status(400).send('请提供订阅链接，例如 ?url=你的订阅地址');

  try {
    // 1. 读取固定模板
    const fixedConfig = await loadYaml(FIXED_CONFIG_URL);

    // 2. 确保 `proxies` 和 `proxy-groups` 存在
    if (!Array.isArray(fixedConfig.proxies)) {
      fixedConfig.proxies = [];
    }
    if (!Array.isArray(fixedConfig['proxy-groups'])) {
      fixedConfig['proxy-groups'] = [];
    }

    // 3. 读取订阅数据
    const response = await axios.get(subUrl, { headers: { 'User-Agent': 'Clash Verge' } });
    let decodedData = response.data;

    // 4. Base64 解码（如果是 Base64 格式）
    try {
      const tempDecoded = Buffer.from(decodedData, 'base64').toString('utf-8');
      if (tempDecoded.includes('proxies:') || tempDecoded.includes('port:')) {
        decodedData = tempDecoded;
      }
    } catch (e) {}

    // 5. 解析订阅数据
    let subConfig;
    if (decodedData.includes('proxies:')) {
      subConfig = yaml.load(decodedData);
    } else {
      subConfig = { proxies: [] };
    }

    // 6. 确保 `subConfig.proxies` 是数组
    if (!Array.isArray(subConfig.proxies)) {
      subConfig.proxies = [];
    }

    // 7. 合并 `proxies` 并去重
    const mergedProxies = [...fixedConfig.proxies, ...subConfig.proxies];
    const seen = new Map();
    fixedConfig.proxies = mergedProxies.filter(proxy => {
      if (!proxy?.name) return false;
      if (!seen.has(proxy.name)) {
        seen.set(proxy.name, true);
        return true;
      }
      return false;
    });

    // 8. **更新 `proxy-groups`**
    fixedConfig['proxy-groups'] = fixedConfig['proxy-groups'].map(group => {
      if (Array.isArray(group.proxies)) {
        // 保留 `proxy-groups` 里的组结构
        return {
          ...group,
          proxies: fixedConfig.proxies.map(p => p.name) // **自动填充代理**
        };
      }
      return group;
    });

    // 9. **输出最终 YAML**
    res.set('Content-Type', 'text/yaml');
    res.send(yaml.dump(fixedConfig));

  } catch (error) {
    res.status(500).send(`转换失败：${error.message}`);
  }
});

module.exports = app;
