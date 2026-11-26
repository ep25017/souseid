import { useState, useEffect } from 'react';

// 初期アイテムデータ（使用頻度・場所・状態）
const INITIAL_ITEMS = [
  { id: 1, name: '車のカギ', location: '玄関の棚', freq: 'high', status: 'ok', memo: '赤いキーホルダー付き', photo: null },
  { id: 2, name: 'テレビのリモコン', location: 'リビングの机', freq: 'high', status: 'ok', memo: '黒いケースの横', photo: null },
  { id: 3, name: 'スマホ充電器', location: 'ベッド横', freq: 'high', status: 'ok', memo: 'コンセントに刺さったまま', photo: null },
  { id: 4, name: '防災バッグ', location: '押し入れ', freq: 'low', status: 'ok', memo: '下段の左側', photo: null },
  { id: 5, name: 'ガスバーナー', location: '押し入れ', freq: 'low', status: 'ok', memo: 'キャンプ道具箱の中', photo: null },
  { id: 6, name: 'マイナンバーカード', location: 'リビングの机', freq: 'low', status: 'ok', memo: '一番上の引き出し', photo: null },
];

// 配置できる家具マスター
const FURNITURE_TYPES = [
  { type: 'desk', name: 'リビングの机', icon: '🖥️' },
  { type: 'closet', name: '押し入れ', icon: '🚪' },
  { type: 'entrance', name: '玄関の棚', icon: '🔑' },
  { type: 'bed', name: 'ベッド横', icon: '🛏️' },
  { type: 'shelf', name: '本棚・収納', icon: '📦' },
];

// 5x5の初期部屋レイアウト（25マス）
const INITIAL_ROOM = Array(25).fill(null).map((_, idx) => {
  if (idx === 1) return { name: '押し入れ', icon: '🚪' };
  if (idx === 3) return { name: '玄関の棚', icon: '🔑' };
  if (idx === 12) return { name: 'リビングの机', icon: '🖥️' };
  if (idx === 20) return { name: 'ベッド横', icon: '🛏️' };
  return null;
});

export default function App() {
  // LocalStorageからデータ読み込み（PythonのJSON読み込み相当）
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('mono_items');
    return saved ? JSON.parse(saved) : INITIAL_ITEMS;
  });
  const [roomGrid, setRoomGrid] = useState(() => {
    const saved = localStorage.getItem('mono_room');
    return saved ? JSON.parse(saved) : INITIAL_ROOM;
  });

  const [tab, setTab] = useState('quiz'); // 'quiz' | 'hunt' | 'room' | 'add'
  
  // クイズ（思いだしアウトプット）用ステート
  const [quizList, setQuizList] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);

  // 宝探しモード用ステート
  const [huntingItem, setHuntingItem] = useState(null);
  const [foundLocation, setFoundLocation] = useState('');
  const [foundMemo, setFoundMemo] = useState('');
  const [foundPhoto, setFoundPhoto] = useState(null);

  // 2D部屋モード用ステート
  const [editMode, setEditMode] = useState(false);
  const [selectedBrush, setSelectedBrush] = useState(FURNITURE_TYPES[0]);
  const [selectedFurniture, setSelectedFurniture] = useState(null);

  // 新規登録用ステート
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('リビングの机');
  const [newFreq, setNewFreq] = useState('high');

  // データ変更時にスマホ/ブラウザへ自動保存
  useEffect(() => {
    localStorage.setItem('mono_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('mono_room', JSON.stringify(roomGrid));
  }, [roomGrid]);

  // 出題リスト生成（所持している物から使用頻度を加味して最大5問抽出）
  const startNewQuiz = () => {
    const activeItems = items.filter((item) => item.status !== 'unowned');
    // 高頻度アイテムを優先しつつシャッフル
    const weighted = [...activeItems].sort((a, b) => {
      const scoreA = (a.freq === 'high' ? 0.3 : 0) + Math.random();
      const scoreB = (b.freq === 'high' ? 0.3 : 0) + Math.random();
      return scoreB - scoreA;
    });
    setQuizList(weighted.slice(0, 5));
    setQuizIndex(0);
    setIsFlipped(false);
  };

  useEffect(() => {
    if (quizList.length === 0) startNewQuiz();
  }, []);

  // スワイプ・回答処理（左＝ある / 右＝ない / 持ってない）
  const handleAnswer = (result) => {
    const current = quizList[quizIndex];
    if (!current) return;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== current.id) return item;
        if (result === 'exists') return { ...item, status: 'ok' };
        if (result === 'missing') return { ...item, status: 'lost' };
        if (result === 'unowned') return { ...item, status: 'unowned' };
        return item;
      })
    );

    setIsFlipped(false);
    setQuizIndex((prev) => prev + 1);
  };

  // タッチスワイプ判定
  const onTouchStart = (e) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchStartX === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX;
    if (diffX < -60) handleAnswer('exists');  // 左スワイプ＝ある
    if (diffX > 60) handleAnswer('missing');  // 右スワイプ＝ない
    setTouchStartX(null);
  };

  // カメラ・写真読み込み
  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFoundPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  // 宝探し完了（「見つけた！」登録）
  const completeHunt = (e) => {
    e.preventDefault();
    setItems((prev) =>
      prev.map((item) =>
        item.id === huntingItem.id
          ? { ...item, status: 'ok', location: foundLocation || item.location, memo: foundMemo, photo: foundPhoto || item.photo }
          : item
      )
    );
    setHuntingItem(null);
    setFoundMemo('');
    setFoundPhoto(null);
  };

  // 2D部屋のタイルクリック処理
  const handleTileClick = (index) => {
    if (editMode) {
      const next = [...roomGrid];
      next[index] = selectedBrush ? { name: selectedBrush.name, icon: selectedBrush.icon } : null;
      setRoomGrid(next);
    } else if (roomGrid[index]) {
      setSelectedFurniture(roomGrid[index]);
    }
  };

  // 新規アイテム追加
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const newItem = {
      id: Date.now(),
      name: newName,
      location: newLocation,
      freq: newFreq,
      status: 'ok',
      memo: '',
      photo: null,
    };
    setItems([...items, newItem]);
    setNewName('');
    alert(`「${newName}」を登録しました！`);
  };

  // 部屋の評価点とコメント計算
  const ownedItems = items.filter((i) => i.status !== 'unowned');
  const okItems = ownedItems.filter((i) => i.status === 'ok');
  const lostItems = ownedItems.filter((i) => i.status === 'lost');
  const score = ownedItems.length === 0 ? 100 : Math.round((okItems.length / ownedItems.length) * 100);

  const getScoreComment = () => {
    if (score === 100) return '✨ 完璧！すべての物の場所を把握できています！';
    if (score >= 70) return '👍 いい調子！迷子の物を宝探しで見つけよう。';
    return '💦 迷子が増えています！部屋を片付けて定位置を思い出そう。';
  };

  // 配置済み家具の一覧（選択肢用）
  const placedFurnitureNames = Array.from(
    new Set(roomGrid.filter(Boolean).map((f) => f.name))
  );

  return (
    <div style={styles.container}>
      {/* レトロドット調の共通スタイル */}
      <style>{`
        body { margin: 0; background: #1e1e2e; font-family: 'Courier New', monospace, sans-serif; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

      {/* ヘッダー */}
      <header style={styles.header}>
        <h1 style={styles.title}>👾 モノの記憶クエスト</h1>
        <div style={styles.badge}>迷子: {lostItems.length}個</div>
      </header>

      {/* メインコンテンツ */}
      <main style={styles.main}>
        {/* 1. 思いだしアウトプット */}
        {tab === 'quiz' && (
          <div>
            <h2 style={styles.subTitle}>🧠 思いだしアウトプット</h2>
            <p style={styles.hint}>場所を思い出してからカードをタップ！<br />← 左スワイプ「ある」 / 右スワイプ「ない」 →</p>

            {quizIndex < quizList.length ? (
              <div
                style={styles.card}
                onClick={() => setIsFlipped(!isFlipped)}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                <div style={styles.cardCount}>第 {quizIndex + 1} / {quizList.length} 問</div>
                <div style={styles.itemName}>{quizList[quizIndex].name}</div>

                {!isFlipped ? (
                  <div style={styles.cardPrompt}>どこにあるか思い浮かべて…<br />（タップで答え合わせ）</div>
                ) : (
                  <div style={styles.answerBox}>
                    <div>📍 登録場所: <strong>{quizList[quizIndex].location}</strong></div>
                    {quizList[quizIndex].memo && <div>📝 {quizList[quizIndex].memo}</div>}
                    {quizList[quizIndex].photo && (
                      <img src={quizList[quizIndex].photo} alt="証拠写真" style={styles.previewImg} />
                    )}
                  </div>
                )}

                <div style={styles.swipeButtons} onClick={(e) => e.stopPropagation()}>
                  <button style={styles.btnExists} onClick={() => handleAnswer('exists')}>
                    ← ある！
                  </button>
                  <button style={styles.btnMissing} onClick={() => handleAnswer('missing')}>
                    ない… →
                  </button>
                </div>
                <button
                  style={styles.btnUnowned}
                  onClick={(e) => { e.stopPropagation(); handleAnswer('unowned'); }}
                >
                  🚫 所持していない（今後出さない）
                </button>
              </div>
            ) : (
              <div style={styles.card}>
                <h3>🎉 今日の思いだし完了！</h3>
                <p>記憶の定着スコア: <strong>{score}点</strong></p>
                {lostItems.length > 0 && (
                  <button style={styles.btnPrimary} onClick={() => setTab('hunt')}>
                    🔍 迷子（{lostItems.length}個）の宝探しへ行く
                  </button>
                )}
                <button style={styles.btnSecondary} onClick={startNewQuiz}>
                  🔄 もう1セット挑戦する
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. 宝探しモード */}
        {tab === 'hunt' && (
          <div>
            <h2 style={styles.subTitle}>🔍 宝探しモード</h2>
            {lostItems.length === 0 ? (
              <div style={styles.card}>現在、迷子のアイテムはありません！素晴らしい！</div>
            ) : (
              lostItems.map((item) => (
                <div key={item.id} style={styles.listCard}>
                  <div>
                    <strong>❓ {item.name}</strong>
                    <div style={{ fontSize: '12px', color: '#aaa' }}>前回の場所: {item.location}</div>
                  </div>
                  <button
                    style={styles.btnPrimary}
                    onClick={() => {
                      setHuntingItem(item);
                      setFoundLocation(item.location);
                      setFoundMemo(item.memo || '');
                    }}
                  >
                    見つけた！
                  </button>
                </div>
              ))
            )}

            {/* 見つけた登録モーダル */}
            {huntingItem && (
              <form onSubmit={completeHunt} style={styles.modal}>
                <h3>🎉 「{huntingItem.name}」を発見！</h3>
                <label style={styles.label}>見つけた場所（家具）:</label>
                <select
                  style={styles.input}
                  value={foundLocation}
                  onChange={(e) => setFoundLocation(e.target.value)}
                >
                  {placedFurnitureNames.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>

                <label style={styles.label}>場所のメモ:</label>
                <input
                  style={styles.input}
                  placeholder="例：棚の右端にあった"
                  value={foundMemo}
                  onChange={(e) => setFoundMemo(e.target.value)}
                />

                <label style={styles.label}>📷 証拠写真を撮る（任意）:</label>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} />
                {foundPhoto && <img src={foundPhoto} alt="撮影" style={styles.previewImg} />}

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button type="submit" style={styles.btnExists}>保存して部屋に反映</button>
                  <button type="button" style={styles.btnSecondary} onClick={() => setHuntingItem(null)}>キャンセル</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 3. 2Dドット調 部屋マップ */}
        {tab === 'room' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={styles.subTitle}>🏠 2Dマイルーム</h2>
              <button
                style={editMode ? styles.btnExists : styles.btnSecondary}
                onClick={() => { setEditMode(!editMode); setSelectedFurniture(null); }}
              >
                {editMode ? '✅ 配置完了' : '🛠️ 模様替え'}
              </button>
            </div>

            {/* 部屋の評価とコメント */}
            <div style={styles.scoreBox}>
              <div>部屋の評価: <strong>{score} / 100点</strong></div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>{getScoreComment()}</div>
            </div>

            {/* 模様替えパレット */}
            {editMode && (
              <div style={styles.palette}>
                {FURNITURE_TYPES.map((f) => (
                  <button
                    key={f.type}
                    style={{
                      ...styles.paletteBtn,
                      borderColor: selectedBrush?.name === f.name ? '#4ade80' : '#555',
                    }}
                    onClick={() => setSelectedBrush(f)}
                  >
                    {f.icon} {f.name}
                  </button>
                ))}
                <button
                  style={{ ...styles.paletteBtn, borderColor: selectedBrush === null ? '#f87171' : '#555' }}
                  onClick={() => setSelectedBrush(null)}
                >
                  🟩 床に戻す
                </button>
              </div>
            )}

            {/* 5x5 ドットタイル部屋 */}
            <div style={styles.roomGrid}>
              {roomGrid.map((cell, idx) => {
                // その家具に紐づくアイテム数と迷子数
                const cellItems = cell ? ownedItems.filter((i) => i.location === cell.name) : [];
                const hasLost = cellItems.some((i) => i.status === 'lost');

                return (
                  <div
                    key={idx}
                    style={{
                      ...styles.tile,
                      background: cell ? '#3b4252' : '#2e3440',
                    }}
                    onClick={() => handleTileClick(idx)}
                  >
                    {cell && (
                      <>
                        <span style={{ fontSize: '24px' }}>{cell.icon}</span>
                        <span style={{ fontSize: '10px', textAlign: 'center' }}>{cell.name}</span>
                        {cellItems.length > 0 && (
                          <span style={{ ...styles.countBadge, background: hasLost ? '#ef4444' : '#3b82f6' }}>
                            {cellItems.length}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 家具タップ時の収納リスト表示 */}
            {selectedFurniture && !editMode && (
              <div style={styles.modal}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h3>{selectedFurniture.icon} {selectedFurniture.name} の中身</h3>
                  <button onClick={() => setSelectedFurniture(null)}>✖</button>
                </div>
                {ownedItems.filter((i) => i.location === selectedFurniture.name).length === 0 ? (
                  <p style={{ color: '#aaa' }}>ここにはまだ何も登録されていません。</p>
                ) : (
                  ownedItems
                    .filter((i) => i.location === selectedFurniture.name)
                    .map((item) => (
                      <div key={item.id} style={styles.storedItem}>
                        <div>
                          {item.status === 'lost' ? '❓ [迷子中] ' : '✅ '}
                          <strong>{item.name}</strong>
                          {item.memo && <div style={{ fontSize: '12px', color: '#ccc' }}>📝 {item.memo}</div>}
                        </div>
                        {item.photo && <img src={item.photo} alt={item.name} style={styles.thumbImg} />}
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. 新規登録・設定 */}
        {tab === 'add' && (
          <div>
            <h2 style={styles.subTitle}>➕ 持ち物の新規登録</h2>
            <form onSubmit={handleAddItem} style={styles.card}>
              <label style={styles.label}>物の名前:</label>
              <input
                style={styles.input}
                placeholder="例：自転車のカギ、印鑑"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />

              <label style={styles.label}>定位置（家具）:</label>
              <select style={styles.input} value={newLocation} onChange={(e) => setNewLocation(e.target.value)}>
                {placedFurnitureNames.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>

              <label style={styles.label}>使用頻度（出題されやすさ）:</label>
              <select style={styles.input} value={newFreq} onChange={(e) => setNewFreq(e.target.value)}>
                <option value="high">よく使う（出やすい）</option>
                <option value="low">たまに使う（忘れやすい）</option>
              </select>

              <button type="submit" style={styles.btnPrimary}>登録する</button>
            </form>

            <button
              style={{ ...styles.btnSecondary, marginTop: '24px', width: '100%' }}
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
            >
              ⚠️ データを初期状態にリセット
            </button>
          </div>
        )}
      </main>

      {/* 下部ナビゲーションバー */}
      <nav style={styles.nav}>
        <button style={tab === 'quiz' ? styles.navActive : styles.navBtn} onClick={() => setTab('quiz')}>
          🧠 思いだし
        </button>
        <button style={tab === 'hunt' ? styles.navActive : styles.navBtn} onClick={() => setTab('hunt')}>
          🔍 宝探し({lostItems.length})
        </button>
        <button style={tab === 'room' ? styles.navActive : styles.navBtn} onClick={() => setTab('room')}>
          🏠 2D部屋
        </button>
        <button style={tab === 'add' ? styles.navActive : styles.navBtn} onClick={() => setTab('add')}>
          ➕ 登録
        </button>
      </nav>
    </div>
  );
}

// スマホ画面サイズのレトロ風スタイル定義
const styles = {
  container: { maxWidth: '430px', margin: '0 auto', minHeight: '100vh', background: '#24273a', color: '#cad3f5', display: 'flex', flexDirection: 'column', borderLeft: '2px solid #494d64', borderRight: '2px solid #494d64' },
  header: { padding: '14px 16px', background: '#181926', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #494d64' },
  title: { margin: 0, fontSize: '18px', color: '#a6da95' },
  badge: { background: '#ed8796', color: '#181926', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' },
  main: { flex: 1, padding: '16px', paddingBottom: '80px' },
  subTitle: { margin: '0 0 8px 0', fontSize: '16px', color: '#8aadf4' },
  hint: { fontSize: '12px', color: '#a5adcb', marginBottom: '12px' },
  card: { background: '#363a4f', border: '3px solid #8aadf4', borderRadius: '8px', padding: '20px', textAlign: 'center', boxShadow: '4px 4px 0px #181926' },
  cardCount: { fontSize: '12px', color: '#f5a97f', marginBottom: '12px' },
  itemName: { fontSize: '26px', fontWeight: 'bold', margin: '16px 0', color: '#fff' },
  cardPrompt: { padding: '20px', background: '#24273a', borderRadius: '6px', color: '#a5adcb', fontSize: '14px' },
  answerBox: { padding: '14px', background: '#1e2030', borderRadius: '6px', border: '2px dashed #a6da95', textAlign: 'left' },
  swipeButtons: { display: 'flex', gap: '10px', marginTop: '20px' },
  btnExists: { flex: 1, padding: '12px', background: '#a6da95', color: '#181926', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px' },
  btnMissing: { flex: 1, padding: '12px', background: '#ed8796', color: '#181926', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px' },
  btnUnowned: { width: '100%', marginTop: '10px', padding: '8px', background: 'transparent', color: '#a5adcb', border: '1px solid #5b6078', borderRadius: '6px', fontSize: '12px' },
  btnPrimary: { padding: '10px 16px', background: '#8aadf4', color: '#181926', border: 'none', borderRadius: '6px', fontWeight: 'bold', marginTop: '8px' },
  btnSecondary: { padding: '10px 16px', background: '#494d64', color: '#cad3f5', border: 'none', borderRadius: '6px', marginTop: '8px' },
  listCard: { background: '#363a4f', padding: '12px', borderRadius: '6px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid #ed8796' },
  modal: { background: '#1e2030', border: '3px solid #f5a97f', padding: '16px', borderRadius: '8px', marginTop: '16px' },
  label: { display: 'block', textAlign: 'left', fontSize: '12px', marginTop: '10px', marginBottom: '4px', color: '#a5adcb' },
  input: { width: '100%', padding: '8px', boxSizing: 'border-box', background: '#363a4f', color: '#fff', border: '1px solid #5b6078', borderRadius: '4px' },
  previewImg: { width: '100%', maxHeight: '150px', objectFit: 'cover', marginTop: '8px', borderRadius: '4px' },
  thumbImg: { width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px' },
  scoreBox: { background: '#1e2030', padding: '10px', borderRadius: '6px', border: '2px solid #a6da95', marginBottom: '12px' },
  palette: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' },
  paletteBtn: { padding: '6px 8px', background: '#363a4f', color: '#fff', border: '2px solid #555', borderRadius: '4px', fontSize: '12px' },
  roomGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', background: '#181926', padding: '6px', borderRadius: '8px', border: '3px solid #5b6078' },
  tile: { aspectRatio: '1', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', border: '1px solid #494d64', cursor: 'pointer' },
  countBadge: { position: 'absolute', top: '2px', right: '2px', color: '#fff', fontSize: '10px', padding: '1px 5px', borderRadius: '10px', fontWeight: 'bold' },
  storedItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #363a4f' },
  nav: { position: 'fixed', bottom: 0, width: '100%', maxWidth: '430px', display: 'flex', background: '#181926', borderTop: '3px solid #494d64' },
  navBtn: { flex: 1, padding: '14px 4px', background: 'transparent', color: '#a5adcb', border: 'none', fontSize: '12px' },
  navActive: { flex: 1, padding: '14px 4px', background: '#363a4f', color: '#a6da95', border: 'none', fontWeight: 'bold', fontSize: '12px' },
};