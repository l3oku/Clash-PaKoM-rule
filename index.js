const express = require('express');
const axios = require('axios');
const yaml = require('js-yaml');
const app = express();

// 辅助函数：对名称中非 ASCII 字符进行 Unicode 转义
function escapeUnicode(str) {
  return str.replace(/[\u0080-\uFFFF]/g, function(c) {
    return '\\U' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4).toUpperCase();
  });
}

// 根据 proxies 数组构造符合要求的 YAML 字符串，保证顺序、缩进、转义符合示例格式
function buildProxiesString(proxiesArray) {
  return proxiesArray.map(proxy => {
    // 确保各字段存在且数据正确
    const name = escapeUnicode(proxy.name || '');
    const type = proxy.type || 'ss';
    const server = proxy.server || '';
    const port = proxy.port || '';
    const cipher = proxy.cipher || 'chacha20-ietf-poly1305';
    const password = proxy.password || '';
    const udp = proxy.udp !== undefined ? proxy.udp : true;
    return `  - name: "${name}"
    type: ${type}
    server: ${server}
    port: ${port}
    cipher: ${cipher}
    password: ${password}
    udp: ${udp}`;
  }).join('\n');
}

// 整体配置模板（除 proxies 部分外保持不变），注意模板中 proxies 块会被替换
const configTemplate = `proxies:
  - name: "\\U0001F1ED\\U0001F1F0 香港 01 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5001
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1ED\\U0001F1F0 香港 02 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5003
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1ED\\U0001F1F0 香港 03 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5002
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1E8\\U0001F1F3 台湾 01 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5010
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1E8\\U0001F1F3 台湾 02 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5011
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1E8\\U0001F1F3 台湾 03 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5012
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1F8\\U0001F1EC 新加坡 01 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5020
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1F8\\U0001F1EC 新加坡 02 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5021
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1F8\\U0001F1EC 新加坡 03 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5022
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1EF\\U0001F1F5 日本 01 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5030
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1EF\\U0001F1F5 日本 02 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5031
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1FA\\U0001F1F8 美国 01 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5040
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1FA\\U0001F1F8 美国 02 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5041
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
dns:
  enable: true
  listen: '0.0.0.0:1053'
  ipv6: true
  enhanced-mode: fake-ip
  fake-ip-range: 28.0.0.1/8
  fake-ip-filter:
    - '*'
    - +.lan
  default-nameserver:
    - 223.5.5.5
    - 223.6.6.6
  nameserver:
    - 'https://223.5.5.5/dns-query#h3=true'
    - 'https://223.6.6.6/dns-query#h3=true'
rule-providers:
  private:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.yaml
    path: ./ruleset/private.yaml
    behavior: domain
    interval: 86400
    format: yaml
    type: http
  cn_domain:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.yaml
    path: ./ruleset/cn_domain.yaml
    behavior: domain
    interval: 86400
    format: yaml
    type: http
  Spotify_domain:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Spotify/Spotify.yaml
    path: ./ruleset/Spotify_domain.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  youtube_domain:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/YouTube/YouTube.yaml
    path: ./ruleset/youtube_domain.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  telegram_domain:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.yaml
    path: ./ruleset/telegram_domain.yaml
    behavior: domain
    interval: 86400
    format: yaml
    type: http
  google_domain:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/6otho/yamal-pako/refs/heads/main/google.yaml
    path: ./ruleset/google_domain.yaml
    behavior: domain
    interval: 86400
    format: yaml
    type: http
  geolocation-!cn:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.yaml
    path: ./ruleset/geolocation-!cn.yaml
    behavior: domain
    interval: 86400
    format: yaml
    type: http
  cn_ip:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.yaml
    path: ./ruleset/cn_ip.yaml
    behavior: ipcidr
    interval: 86400
    format: yaml
    type: http
  telegram_ip:
    url: >-
      https://mirror.ghproxy.com/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.yaml
    path: ./ruleset/telegram_ip.yaml
    behavior: ipcidr
    interval: 86400
    format: yaml
    type: http
  google_ip:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/google.yaml
    path: ./ruleset/google_ip.yaml
    behavior: ipcidr
    interval: 86400
    format: yaml
    type: http
  bing:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Bing/Bing.yaml
    path: ./ruleset/bing.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  copilot:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Copilot/Copilot.yaml
    path: ./ruleset/copilot.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  claude:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Claude/Claude.yaml
    path: ./ruleset/claude.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  bard:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/BardAI/BardAI.yaml
    path: ./ruleset/bard.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  openai:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/OpenAI/OpenAI.yaml
    path: ./ruleset/openai.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  steam:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Steam/Steam.yaml
    path: ./ruleset/steam.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  netflix_domain:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Netflix/Netflix.yaml
    path: ./ruleset/netflix_domain.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  emby_domain:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Emby/Emby.yaml
    path: ./ruleset/emby_domain.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  dns_leak:
    type: http
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/6otho/loon-/refs/heads/main/Prevent_DNS_Leaks.list
    path: ./ruleset/dns_leak.yaml
    behavior: classical
    interval: 86400
    format: yaml
proxy-groups:
  - icon: >-
      https://raw.githubusercontent.com/lige47/QuanX-icon-rule/main/icon/Loon.png
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    name: PAKO
    type: select
    proxies:
      - AUTO
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Auto.png
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    name: AUTO
    type: select
    interval: 3000
  - icon: >-
      https://raw.githubusercontent.com/lige47/QuanX-icon-rule/main/icon/AppleIntelligence.png
    name: AIGC
    type: select
    proxies:
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - PAKO
      - AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Telegram.png
    name: Telegram
    type: select
    proxies:
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - PAKO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Google_Search.png
    name: Google
    type: select
    proxies:
      - PAKO
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Spotify.png
    name: Spotify
    type: select
    proxies:
      - PAKO
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Netflix_Letter.png
    name: Netflix
    type: select
    proxies:
      - PAKO
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/YouTube.png
    name: Youtube
    type: select
    proxies:
      - PAKO
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Steam.png
    name: Steam
    type: select
    proxies:
      - PAKO
      - DIRECT
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/China_Map.png
    name: Mainland
    type: select
    proxies:
      - DIRECT
      - PAKO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/HK.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)香港|Hong Kong|HK|\\U0001F1ED\\U0001F1F0"
    name: HK AUTO
    type: url-test
    interval: 300
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/SG.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)新加坡|Singapore|\\U0001F1F8\\U0001F1EC"
    name: SG AUTO
    type: url-test
    interval: 300
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/JP.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)日本|Japan|\\U0001F1EF\\U0001F1F5"
    name: JP AUTO
    type: url-test
    interval: 300
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/US.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)美国|USA|\\U0001F1FA\\U0001F1F8"
    name: US AUTO
    type: url-test
    interval: 300
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/KR.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)韩国|South Korea|\\U0001F1F0\\U0001F1F7"
    name: KR AUTO
    type: url-test
    interval: 300
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/XD.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)^(?!.*(?:新加坡|Singapore|\\U0001F1F8\\U0001F1EC|日本|Japan|\\U0001F1EF\\U0001F1F5|美国|USA|\\U0001F1FA\\U0001F1F8|韩国|South Korea|\\U0001F1F0\\U0001F1F7|香港|Hong Kong|HK|\\U0001F1ED\\U0001F1F0)).*$"
    name: GA AUTO
    type: url-test
    interval: 300
rules:
  - 'DOMAIN-KEYWORD,vidhub1.cc,DIRECT'
  - 'DOMAIN,domainname,PAKO'
  - 'RULE-SET,Spotify_domain,Spotify'
  - 'RULE-SET,youtube_domain,Youtube'
  - 'RULE-SET,copilot,AIGC'
  - 'RULE-SET,claude,AIGC'
  - 'RULE-SET,bard,AIGC'
  - 'RULE-SET,openai,AIGC'
  - 'DOMAIN-SUFFIX,chat.openai.com,AIGC'
  - 'DOMAIN-SUFFIX,chatgpt.com,AIGC'
  - 'DOMAIN-SUFFIX,api.openai.com,AIGC'
  - 'DOMAIN-SUFFIX,auth0.com,AIGC'
  - 'RULE-SET,google_domain,Google'
  - 'RULE-SET,google_ip,Google'
  - 'RULE-SET,telegram_domain,Telegram'
  - 'RULE-SET,telegram_ip,Telegram'
  - 'RULE-SET,private,PAKO'
  - 'RULE-SET,netflix_domain,Netflix'
  - 'RULE-SET,emby_domain,Netflix'
  - 'RULE-SET,bing,Google'
  - 'RULE-SET,steam,Steam'
  - 'RULE-SET,geolocation-!cn,PAKO'
  - 'RULE-SET,cn_domain,Mainland'
  - 'RULE-SET,cn_ip,Mainland'
  - 'RULE-SET,dns_leak,PAKO'
  - 'GEOIP,CN,Mainland'
  - 'MATCH,PAKO'
`;

try {
  const subUrl = req.query.url;
  if (!subUrl) return res.status(400).send('请提供订阅链接，例如 ?url=你的订阅地址');

  // 1. 获取订阅数据
  let subData = (await axios.get(subUrl, { headers: { 'User-Agent': 'Clash Verge' } })).data;
  
  // 2. 如有必要，尝试 Base64 解码
  try {
    const decoded = Buffer.from(subData, 'base64').toString('utf8');
    if (decoded.includes('proxies:') || decoded.includes('port:')) {
      subData = decoded;
    }
  } catch (e) {}

  // 3. 解析订阅数据中的 YAML
  let subConfig = {};
  if (subData.includes('proxies:')) {
    subConfig = yaml.load(subData);
  }
  if (!subConfig.proxies || !Array.isArray(subConfig.proxies) || subConfig.proxies.length === 0) {
    return res.status(400).send('订阅数据中未包含有效的节点信息');
  }

  // 4. 根据订阅的 proxies 数组构造新的 proxies 字符串
  const newProxiesStr = buildProxiesString(subConfig.proxies);

  // 5. 用正则替换模板中从开头到第一行以 "dns:" 开始前的 proxies 部分
  const outputConfig = configTemplate.replace(/^(proxies:\n)([\s\S]*?)(?=^dns:)/m, `proxies:\n${newProxiesStr}\n`);

  res.set('Content-Type', 'text/yaml');
  res.send(outputConfig);
} catch (error) {
  res.status(500).send(`转换失败：${error.message}`);
}
});

module.exports = app;
