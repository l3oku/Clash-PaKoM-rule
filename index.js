const express = require('express');
const axios = require('axios');
const yaml = require('js-yaml');
const app = express();

const FIXED_CONFIG_URL = 'https://gh.ikuu.eu.org/https://raw.githubusercontent.com/6otho/Yaml-PaKo/refs/heads/main/PAKO_urltest.yaml';

async function loadYaml(url) {
  const response = await axios.get(url, { headers: { 'User-Agent': 'Clash Verge' } });
  return yaml.load(response.data);
}

app.get('/', async (req, res) => {
  const subUrl = req.query.url;
  if (!subUrl) return res.status(400).send('请提供订阅链接，例如 ?url=你的订阅地址');

  try {
    // 加载模板配置
    const fixedConfig = await loadYaml(FIXED_CONFIG_URL);
    if (!Array.isArray(fixedConfig.proxies)) fixedConfig.proxies = [];

    // 获取订阅数据
    const response = await axios.get(subUrl, { headers: { 'User-Agent': 'Clash Verge' } });
    let decodedData = response.data;

    // 尝试 Base64 解码
    try {
      const maybe = Buffer.from(decodedData, 'base64').toString('utf-8');
      if (maybe.includes('proxies:') || maybe.includes('proxy-groups:')) {
        decodedData = maybe;
      }
    } catch (e) {}

    // 解析订阅 YAML
    let subConfig = {};
    if (decodedData.includes('proxies:')) {
      subConfig = yaml.load(decodedData);
    } else {
      // 非标准格式，构造基本代理
      subConfig = {
        proxies: decodedData.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const parts = line.split('|');
            return parts.length >= 5 ? {
              name: `${parts[1]}-${parts[2]}`,
              type: parts[0] || 'ss',
              server: parts[1],
              port: parseInt(parts[2]),
              cipher: parts[3] || 'aes-256-gcm',
              password: parts[4]
            } : null;
          }).filter(Boolean)
      };
    }

    // 混合逻辑开始
    if (Array.isArray(subConfig.proxies) && subConfig.proxies.length > 0) {
      // 合并代理（模板代理 + 订阅代理）
      const templateProxies = fixedConfig.proxies;
      const allProxies = [...templateProxies, ...subConfig.proxies];

      // 根据 name 去重（保留订阅原始结构，包括 traffic 字段）
      const seen = new Map();
      fixedConfig.proxies = allProxies.filter(proxy => {
        if (!proxy?.name) return false;
        if (!seen.has(proxy.name)) {
          seen.set(proxy.name, true);
          return true;
        }
        return false;
      });

      // 更新 proxy-groups 中的代理名
      if (Array.isArray(fixedConfig['proxy-groups'])) {
        const validNames = fixedConfig.proxies.map(p => p.name);
        fixedConfig['proxy-groups'] = fixedConfig['proxy-groups'].map(group => {
          if (Array.isArray(group.proxies)) {
            return {
              ...group,
              proxies: group.proxies.filter(name => validNames.includes(name))
            };
          }
          return group;
        });
      }
    }

    res.set('Content-Type', 'text/yaml');
    res.send(yaml.dump(fixedConfig, { lineWidth: -1 }));
  } catch (error) {
    console.error(error);
    res.status(500).send(`转换失败：${error.message}`);
  }
});

module.exports = app;