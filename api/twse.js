// api/twse.js - TWSE 專用 Vercel Serverless Proxy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, date, stockno, codes } = req.query;
  // codes = 逗號分隔的純代號字串，e.g. "1303,6261,3260"
  const codesSet = codes ? new Set(codes.split(',').map(c => c.trim()).filter(Boolean)) : null;

  try {
    let targetUrl;

    if (type === 't86') {
      if (!date) return res.status(400).json({ error: 'date required (yyyymmdd)' });
      targetUrl = `https://www.twse.com.tw/rwd/zh/fund/T86?response=json&date=${date}&selectType=ALLBUT0999`;

    } else if (type === 'stockday') {
      if (!date || !stockno) return res.status(400).json({ error: 'date and stockno required' });
      targetUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${stockno}`;

    } else if (type === 'mis') {
      if (!stockno) return res.status(400).json({ error: 'stockno required' });
      targetUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${stockno}&json=1&delay=0`;

    } else {
      return res.status(400).json({ error: 'type must be t86, stockday, or mis' });
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.twse.com.tw/',
        'Accept': 'application/json, text/javascript, */*',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `TWSE returned ${response.status}`,
        url: targetUrl
      });
    }

    const data = await response.json();

    // ★ T86 codes 過濾：只回傳前端需要的持倉股，大幅縮減 payload
    if (type === 't86' && codesSet && codesSet.size > 0 && Array.isArray(data?.data)) {
      data.data = data.data.filter(row => codesSet.has(String(row[0] || '').trim()));
    }

    // ★ 完全禁用 CDN 快取，確保每次都拿到當日最新資料
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({
      error: err.message,
      hint: 'TWSE server may be blocking requests'
    });
  }
}
