let holidaysMap = {}; // 祝日データを保持する用
let weatherChart = null; // グラフオブジェクトを保持する用

// 祝日データの取得 (ページ読み込み時のみ1回実行)
async function fetchHolidays() {
  try {
    const res = await fetch('https://holidays-jp.github.io/api/v1/date.json');
    holidaysMap = await res.json();
  } catch (e) {
    console.error('Holiday fetch error:', e);
  }
}

const brightImages = [];
// 写真に赤い枠（余白）が入るのを防ぐため、自動で完璧にトリミングされ余白が入らない Picsum Photos に変更しました。
// さらに 3840x2160 (4K) の超高解像度を指定しているため、画面全体に綺麗にフィットします。
for (let i = 1; i <= 100; i++) {
  brightImages.push(`https://picsum.photos/3840/2160?random=${i}`);
}

// ランダムで明るい画像を挿入する (1時間ごと)
function updateBackground() {
  const bgContainer = document.getElementById('bg-container');
  const randomIndex = Math.floor(Math.random() * brightImages.length);
  const randomImage = brightImages[randomIndex];
  bgContainer.style.backgroundImage = `url('${randomImage}')`;
}

// 初期化時に1回取得し、1時間ごと(60*60*1000)に更新タイマーをセット
updateBackground();
setInterval(updateBackground, 60 * 60 * 1000);

// 時計と祝日の更新
function updateClock() {
  const now = new Date();
  const hour = now.getHours();

  // 時刻
  const hours = String(hour);
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const clockEl = document.getElementById('clock');
  if (clockEl) clockEl.innerText = `${hours}:${minutes}`;

  // 時間帯に応じた色の反映
  if (clockEl) {
    clockEl.classList.remove('clock-morning', 'clock-afternoon', 'clock-night');
    if (hour >= 6 && hour < 12) {
      clockEl.classList.add('clock-morning');
    } else if (hour >= 12 && hour < 18) {
      clockEl.classList.add('clock-afternoon');
    } else {
      clockEl.classList.add('clock-night');
    }
  }

  // 日付
  const year = now.getFullYear();
  const monthNum = now.getMonth() + 1;
  const month = String(monthNum).padStart(2, '0');
  const dateStr = String(now.getDate()).padStart(2, '0');
  const daysString = ['日', '月', '火', '水', '木', '金', '土'];
  const dayName = daysString[now.getDay()];
  const dateEl = document.getElementById('date');
  if (dateEl) dateEl.innerText = `${year}/${month}/${dateStr} (${dayName})`;

  // 祝日チェック
  const yyyy_mm_dd = `${year}-${month}-${dateStr}`;
  const holidayLabel = document.getElementById('holiday');
  if (holidayLabel) {
    if (holidaysMap[yyyy_mm_dd]) {
      holidayLabel.innerText = holidaysMap[yyyy_mm_dd];
      holidayLabel.style.display = 'inline-block';
    } else {
      holidayLabel.style.display = 'none';
    }
  }

  // 記念日の呼び出し
  updateAnniversary(monthNum, now.getDate());
}

// 記念日（今日は何の日）の取得と表示
async function updateAnniversary(month, date) {
  const annLabel = document.getElementById('anniversary');
  if (!annLabel) return;

  try {
    // Wikipediaの「今日は何の日」APIなどから代表的な記念日を一つ取得
    const res = await fetch(`https://ja.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${date}`);
    const data = await res.json();
    
    if (data.events && data.events.length > 0) {
      // 最も重要な最初の出来事を記念日として表示
      const event = data.events[0];
      // 長すぎる場合は省略
      let text = event.text;
      if (text.length > 20) text = text.substring(0, 19) + '...';
      annLabel.innerText = text;
      annLabel.style.display = 'inline-block';
    }
  } catch (e) {
    annLabel.style.display = 'none';
  }
}

setInterval(updateClock, 1000);

// 温度に応じた文字色クラスを返す
// 8度以下: 青, 18度以上: 赤, その他: 白(空)
function getTempClass(temp) {
  if (temp <= 8) {
    return 'temp-cold';
  } else if (temp >= 18) {
    return 'temp-hot';
  }
  return '';
}

// 天気コードから絵文字への変換
function getWeatherIcon(code) {
  if (code === 0) return '☀️'; // 快晴
  if (code === 1 || code === 2 || code === 3) return '⛅'; // 晴れ時々曇り、曇り
  if (code >= 45 && code <= 48) return '🌫️'; // 霧
  if (code >= 51 && code <= 55) return '🌧️'; // 霧雨
  if (code >= 61 && code <= 65) return '☔'; // 雨
  if (code >= 71 && code <= 77) return '❄️'; // 雪
  if (code >= 80 && code <= 82) return '🌧️'; // にわか雨
  if (code >= 95) return '⛈️'; // 雷雨
  return '☁️';
}

// 天気コードから日本語の説明を返す
function getWeatherDescription(code) {
  if (code === 0) return '快晴';
  if (code === 1 || code === 2 || code === 3) return '晴れ時々曇り';
  if (code >= 45 && code <= 48) return '霧';
  if (code >= 51 && code <= 55) return '霧雨';
  if (code >= 61 && code <= 65) return '雨';
  if (code >= 71 && code <= 77) return '雪';
  if (code >= 80 && code <= 82) return 'にわか雨';
  if (code >= 95) return '雷雨';
  return '曇り';
}

// 天気データの取得と描画
async function fetchWeather() {
  // 北本市の緯度・経度
  const lat = 36.0333;
  const lon = 139.5333;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&hourly=temperature_2m,precipitation_probability,precipitation,weathercode,windspeed_10m&wind_speed_unit=ms&timezone=Asia%2FTokyo`;

  const hourlyContainer = document.getElementById('hourly-container');
  // 取得開始時にローディングを表示
  hourlyContainer.innerHTML = '<div class="loading">天候データを取得中...</div>';

  try {
    const response = await fetch(url);
    const data = await response.json();

    // サマリーの更新
    const currTemp = data.current.temperature_2m;
    const maxTemp = data.daily.temperature_2m_max[0];
    const minTemp = data.daily.temperature_2m_min[0];

    const currTempEl = document.getElementById('current-temp');
    currTempEl.innerText = `${currTemp}°C`;
    currTempEl.className = `value ${getTempClass(currTemp)}`;

    // 現在の強風判定
    const currentWind = data.current.wind_speed_10m;
    const currentCard = document.querySelector('.current-card');
    if (currentCard) {
      // 既存のスタンプがあれば削除
      const oldStamp = currentCard.querySelector('.wind-stamp-large');
      if (oldStamp) oldStamp.remove();
      
      if (currentWind >= 5) {
        const stamp = document.createElement('span');
        stamp.className = 'wind-stamp-large';
        stamp.innerHTML = '強風 🌬️';
        currentCard.appendChild(stamp);
      }
    }

    const maxTempEl = document.getElementById('max-temp');
    maxTempEl.innerText = `${maxTemp}°C`;
    maxTempEl.className = `value ${getTempClass(maxTemp)}`;

    const minTempEl = document.getElementById('min-temp');
    minTempEl.innerText = `${minTemp}°C`;

    // 天気概況の表示
    const summaryEl = document.getElementById('weather-summary');
    if (summaryEl) {
      let summaryText = getWeatherDescription(data.hourly.weathercode[0]);
      
      // 気温による特徴（猛暑日など）の判定
      let tempRemark = '';
      if (maxTemp >= 35) tempRemark = ' (猛暑日 🔥)';
      else if (maxTemp >= 30) tempRemark = ' (真夏日 ☀️)';
      else if (maxTemp >= 25) tempRemark = ' (夏日 🌡️)';
      else if (maxTemp <= 0) tempRemark = ' (真冬日 ❄️)';

      summaryEl.innerText = `${summaryText}${tempRemark}`;
    }
    minTempEl.className = `value ${getTempClass(minTemp)}`;

    // 湿度は削除されたのでテキスト更新は不要
    // document.getElementById('current-humidity').innerText = `${data.current.relative_humidity_2m}%`;

    // グラフの更新
    updateWeatherChart(data);

    // 1時間ごとの天気の更新
    const hourlyContainer = document.getElementById('hourly-container');
    hourlyContainer.innerHTML = '';

    const now = new Date();
    // 比較用に現在の時間のタイムスタンプ (分秒切り捨て)
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();

    // 表示する16時間分の中での最高・最低気温を特定
    let displayData = [];
    let tempCount = 0;
    for (let i = 0; i < data.hourly.time.length; i++) {
      const forecastTime = new Date(data.hourly.time[i]).getTime();
      if (forecastTime < currentHour) continue;
      if (tempCount >= 16) break;
      displayData.push({ temp: data.hourly.temperature_2m[i], time: forecastTime });
      tempCount++;
    }
    const maxTempInList = Math.max(...displayData.map(d => d.temp));
    const minTempInList = Math.min(...displayData.map(d => d.temp));

    let count = 0;
    for (let i = 0; i < data.hourly.time.length; i++) {
      const forecastTime = new Date(data.hourly.time[i]).getTime();

      // 過去の時間はスキップ（経過した時間は自動で消える機能）
      if (forecastTime < currentHour) {
        continue;
      }

      // 直近16時間分を表示
      if (count >= 16) break;

      const timeDate = new Date(data.hourly.time[i]);
      const hours = String(timeDate.getHours()); // 指示通り先頭の0を消す

      const temp = data.hourly.temperature_2m[i];
      const precipProb = data.hourly.precipitation_probability[i];
      const precip = data.hourly.precipitation[i];
      const weatherCode = data.hourly.weathercode[i];

      const item = document.createElement('div');
      item.className = 'hourly-item';

      // 時刻に応じた色分けクラスの付与
      const h = timeDate.getHours();
      if (h >= 6 && h < 12) {
        item.classList.add('hourly-morning');
      } else if (h >= 12 && h < 18) {
        item.classList.add('hourly-afternoon');
      } else {
        item.classList.add('hourly-night');
      }
      
      // 最高・最低気温のピーク強調
      if (temp === maxTempInList) {
        item.classList.add('max-peak');
        item.innerHTML += '<span class="peak-badge">最高</span>';
      } else if (temp === minTempInList) {
        item.classList.add('min-peak');
        item.innerHTML += '<span class="peak-badge">最低</span>';
      }

      // 強風スタンプ判定 (5m/s以上)
      if (data.hourly.windspeed_10m[i] >= 5) {
        item.innerHTML += '<span class="wind-stamp">強風🌬️</span>';
      }

      // 現在時刻の場合は「現在」と表示
      const timeLabel = (count === 0 && forecastTime === currentHour) ? '現在' : `${hours}:00`;

      // 8度以下青、18度以上赤 のクラスを設定
      const tempColorClass = getTempClass(temp);

      // 降水量1.5mm以上で傘マーク
      const precipClass = precip > 1.5 ? 'heavy-precip' : '';
      const umbrella = precip > 1.5 ? '<span class="umbrella-icon">☔</span>' : '';

      item.innerHTML += `
        <div class="hourly-time">${timeLabel}</div>
        <div class="hourly-icon">${getWeatherIcon(weatherCode)}</div>
        <div class="hourly-temp ${tempColorClass}">${temp}°C</div>
        <div class="hourly-precip ${precipClass}">
          <span class="prob">${precipProb}%</span>
          <span class="mm">${precip}mm${umbrella}</span>
        </div>
      `;
      hourlyContainer.appendChild(item);
      count++;
    }

    // 直近1週間で次に傘が必要な時間を探す (降水量 0.5mm 以上)
    const rainInfoEl = document.getElementById('rain-info');
    let nextRain = null;
    
    for (let i = 0; i < data.hourly.time.length; i++) {
      const forecastTime = new Date(data.hourly.time[i]);
      // 現在より未来かつ降水量が0.5mm以上の最初のポイント
      if (forecastTime.getTime() > now.getTime() && data.hourly.precipitation[i] >= 0.5) {
        nextRain = forecastTime;
        break;
      }
    }

    if (nextRain) {
      const month = nextRain.getMonth() + 1;
      const date = nextRain.getDate();
      const hour = nextRain.getHours();
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const day = dayNames[nextRain.getDay()];
      rainInfoEl.innerHTML = `<span class=\"rain-alert\">☔</span> 次に傘が必要になるのは、<span style=\"font-size: 1.4rem; color: #ef4444;\">${month}/${date}(${day}) の ${hour}時頃</span> です。`;
    } else {
      rainInfoEl.innerHTML = `☀️ 今後1週間以内に降雨情報の予定はありません。`;
    }

    if (count === 0) {
      hourlyContainer.innerHTML = '<div class="loading">表示できるデータがありません</div>';
    }

  } catch (error) {
    console.error('Weather fetch error:', error);
    document.getElementById('hourly-container').innerHTML = `
      <div class="loading" style="color:#f87171; animation: none; padding: 2rem;">
        <div>データを取得できませんでした。再読み込みしてください。</div>
        <button onclick="fetchWeather()" class="retry-button" style="margin-top: 1rem;">
          再読み込み
        </button>
      </div>`;
  }
}

// グラフ描画関数
function updateWeatherChart(data) {
  const ctx = document.getElementById('weather-chart');
  if (!ctx) return;

  const now = new Date();
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
  
  // 現在時刻以降のデータから直近12時間を抽出
  let hourlyData = [];
  for (let i = 0; i < data.hourly.time.length; i++) {
    const d = new Date(data.hourly.time[i]);
    const time = d.getTime();
    if (time >= currentHour) {
      const realHour = d.getHours();
      const displayHour = (realHour % 12) || 12; // 1〜12の形式に変換
      
      hourlyData.push({
        displayLabel: displayHour,
        hour: realHour,
        temp: data.hourly.temperature_2m[i],
        precip: data.hourly.precipitation_probability[i]
      });
    }
    if (hourlyData.length >= 12) break;
  }

  const labels = hourlyData.map(d => d.displayLabel);
  const temperatures = hourlyData.map(d => d.temp);
  const precipitationProbs = hourlyData.map(d => d.precip);

  if (weatherChart) {
    weatherChart.destroy();
  }

  weatherChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '温度 (°C)',
          data: temperatures,
          borderColor: '#f87171',
          borderWidth: 2,
          pointRadius: 0,
          yAxisID: 'yTemp',
          tension: 0.4,
          fill: false
        },
        {
          label: '降水確率 (%)',
          data: precipitationProbs,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          yAxisID: 'yPrecip',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#064e3b', // 本体のテキストカラーに合わせる
            boxWidth: 8,
            font: { size: 9, weight: 'bold' }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          title: { display: true, text: '時刻', color: '#064e3b', font: { size: 9, weight: 'bold' } },
          ticks: {
            font: { size: 10, weight: 'bold' },
            // 時間帯に応じた色の反映
            color: function(context) {
              const hour = hourlyData[context.index]?.hour;
              if (hour === undefined) return 'rgba(255,255,255,0.6)';
              if (hour >= 6 && hour < 12) return '#7dd3fc';
              if (hour >= 12 && hour < 18) return '#fdba74';
              return '#a78bfa';
            }
          },
          grid: { display: false }
        },
        yTemp: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: '温度(°C)', color: '#f87171', font: { size: 8 } },
          ticks: { color: '#f87171', font: { size: 9 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        yPrecip: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: '降水(%)', color: '#60a5fa', font: { size: 8 } },
          min: 0,
          max: 100,
          ticks: { color: '#60a5fa', font: { size: 9 }, stepSize: 50 },
          grid: { display: false }
        }
      }
    }
  });

  // グラフエリアをクリックした際に、専用のグラフページへ移動する
  const container = ctx.parentElement;
  container.title = "クリックして詳細を表示";
  container.onclick = () => {
    window.location.href = 'chart.html';
  };
}

// ニュースを取得してテロップにセットする関数

async function fetchNews() {
    const el = document.getElementById('news-ticker-content');
    if (!el) return;

    try {
        // より安定したNHKニュースに変更
        const rssUrl = 'https://www3.nhk.or.jp/rss/news/cat0.xml';
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&t=${Date.now()}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data && data.status === 'ok' && data.items && data.items.length > 0) {
            const combinedText = data.items.slice(0, 10).map(i => i.title).join('　　【 NEXT 】　　');
            el.innerText = '📺 NHKニュース： ' + combinedText + '　　';
        } else {
            el.innerText = '只今ニュースを更新中です。しばらくお待ちください。';
        }
    } catch (err) {
        console.error('News Fetch Error:', err);
        el.innerText = 'ネットワーク接続を確認してください。ニュースの取得に失敗しました。';
    }
}

// 起動時の初期化フロー
async function init() {
  // 並行してすべてのデータを取得開始（一つを待たずに次へ行く）
  fetchHolidays().then(() => updateClock());
  fetchWeather();
  fetchNews();

  // テロップ速度の制御設定
  const speedSlider = document.getElementById('speed-slider');
  const speedValue = document.getElementById('speed-value');

  if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
      const duration = e.target.value;
      if (speedValue) speedValue.innerText = duration;
      document.documentElement.style.setProperty('--ticker-duration', `${duration}s`);
    });
    // 初期速度として30sを適用
    document.documentElement.style.setProperty('--ticker-duration', '30s');
  }
}

init();

// 10分ごとに天気データを自動更新
setInterval(fetchWeather, 10 * 60 * 1000);

// 10分ごとにニュースを自動更新
setInterval(fetchNews, 10 * 60 * 1000);

// 話題のタグ（Xトレンド風）を取得して表示する関数
async function updateTrendingTags() {
    const container = document.getElementById('trending-tags');
    if (!container) return;

    container.innerHTML = '<div style="font-size:0.75rem;color:#64748b;padding:0 1rem">情報取得中...</div>';

    const renderTags = (tags) => {
        const unique = [...new Set(tags.filter(t => t && t.length >= 2 && t.length <= 15))].slice(0, 15);
        if (unique.length === 0) return false;
        container.innerHTML = unique.map(tag =>
            `<div class="tag-card" onclick="window.open('https://x.com/search?q=${encodeURIComponent(tag)}', '_blank')">#${tag}</div>`
        ).join('');
        return true;
    };

    const trySources = async () => {
        // Yahooがブロックされているため、絶対に取得できる「NHKニュースRSS」を使用する
        const rsSources = [
            'https://www3.nhk.or.jp/rss/news/cat0.xml',     // 主要
            'https://www3.nhk.or.jp/rss/news/cat1.xml',     // 社会
            'https://www3.nhk.or.jp/rss/news/cat7.xml'      // 科学・文化（エンタメ・IT要素）
        ];

        let allTags = [];

        for (const rss of rsSources) {
            try {
                const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}&t=${Date.now()}`;
                const res = await fetch(api);
                const data = await res.json();
                
                if (data.status === 'ok' && data.items?.length > 0) {
                    data.items.forEach(item => {
                        let title = item.title;
                        
                        // ① 【】や「」で囲まれた言葉はトレンドになりやすいので最優先で抜き出す
                        const brackets = title.match(/[【「『](.+?)[】」』]/g);
                        if (brackets) {
                            brackets.forEach(b => {
                                const clean = b.replace(/[【「『】」』]/g, '').trim();
                                if (clean.length >= 2 && clean.length <= 12 && !clean.includes('速報')) {
                                    allTags.push(clean);
                                }
                            });
                        }

                        // ② タイトル全体を記号やスペースで区切り、短い名詞っぽくする
                        const words = title.split(/[\s　、。！？・：；()（）「」【】『』]/g);
                        words.forEach(w => {
                            let clean = w.trim().replace(/^[…ー〜]+|[…ー〜]+$/g, ''); // 両端の無駄な記号を削除
                            
                            // 文字数制限 (長すぎるものは文章なので弾く、短すぎるのも弾く)
                            if (clean.length >= 2 && clean.length <= 8) {
                                // ニュース特有の不要ワードや、助詞で終わる文章っぽいものを弾く
                                const stopWords = ['動画', '写真', '速報', '詳報', 'ライブ', '詳細', '更新', '解説', '発表', 'NHK'];
                                if (!stopWords.includes(clean) && !clean.match(/(について|による|により|から|まで|では|には|する|した|なる|れる|られる|など)$/)) {
                                    allTags.push(clean);
                                }
                            }
                        });
                    });
                }
            } catch (e) {
                console.warn("RSS fetch failed:", e);
            }
        }

        // 抽出したタグがあれば表示、なければ5分後再試行
        if (allTags.length > 0) {
            // シャッフルして偏りをなくす
            allTags.sort(() => Math.random() - 0.5);
            if (renderTags(allTags)) return;
        }

        container.innerHTML = '<div style="font-size:0.75rem;color:#64748b;padding:0 1rem">情報取得中...</div>';
        setTimeout(trySources, 5 * 60 * 1000);
    };

    trySources();
}

// 初期実行と10分ごとの更新設定
updateTrendingTags();
setInterval(updateTrendingTags, 10 * 60 * 1000);

// 画面サイズに合わせて全体を最適にスケーリング（拡大・縮小）する関数
function autoScale() {
    const container = document.getElementById('app-container');
    if (!container) return;

    // 基準サイズ
    const baseWidth = 1920;
    const baseHeight = 1080;

    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // 画面いっぱいに広がる倍率を計算
    const scale = Math.min(winW / baseWidth, winH / baseHeight);

    // スタイルを適用（CSSのFlexboxと組み合わせて中央に固定される）
    container.style.transform = `scale(${scale})`;
    container.style.webkitTransform = `scale(${scale})`;
}

// 読み込み直後とウィンドウサイズ変更時に実行
window.addEventListener('resize', autoScale);
window.onload = autoScale;
autoScale();
