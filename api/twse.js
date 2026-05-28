// api/twse.js - TWSE 撠 Vercel Serverless Proxy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, date, stockno } = req.query;

  try {
    let targetUrl;

    if (type === 't86') {
      // 銝?銝之瘜犖
      if (!date) return res.status(400).json({ error: 'date required (yyyymmdd)' });
      targetUrl = `https://www.twse.com.tw/rwd/zh/fund/T86?response=json&date=${date}&selectType=ALLBUT0999`;

    } else if (type === 'stockday') {
      // 銝???? OHLCV嚗?銵?璅嚗?      if (!date || !stockno) return res.status(400).json({ error: 'date and stockno required' });
      targetUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${stockno}`;

    } else if (type === 'mis') {
      // 銝?/銝??單?銵?
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
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `TWSE returned ${response.status}`,
        url: targetUrl
      });
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({
      error: err.message,
      hint: 'TWSE server may be blocking requests'
    });
  }
}
