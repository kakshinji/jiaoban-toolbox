import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ConfigProvider, Tabs, Card, Input, Button, Tag, Alert, Typography, Space
} from 'antd';
import zhCN from 'antd/locale/zh_CN';

const { Text, Title } = Typography;
const JBD = window.JBD;
const CN = JBD.CN;

/* ================= 公共工具 ================= */

function sortFiles(files) {
  return Array.from(files).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
}

function guessDesc(name) {
  const rules = [
    [/垃圾桶|垃圾筒/, /外溢|溢出|满出|漫出/, '垃圾桶外溢'],
    [/垃圾桶|垃圾筒/, /漂浮|飘/, '垃圾桶旁边漂浮垃圾'],
    [/垃圾桶|垃圾筒/, null, '垃圾桶旁边垃圾外溢'],
    [/河|沟|塘|水面/, /浮萍|水花生|水草/, '河面浮萍'],
    [/河|沟|塘|岸边/, null, '河边垃圾'],
    [/广告|招贴|牛皮癣/, null, '小广告'],
    [/秸秆|油菜杆|稻草/, null, '秸秆乱堆'],
    [/建筑|砖|渣土|砂石/, null, '建筑垃圾'],
    [/粪|污/, null, '粪污外溢'],
    [/杂草|草/, /高|多|丛/, '路边杂草']
  ];
  for (const [w, q, out] of rules) if (w.test(name) && (!q || q.test(name))) return out;
  return '路边垃圾';
}

function useThumbUrls(files) {
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    const list = files.slice(0, 6).map(f => URL.createObjectURL(f));
    setUrls(list);
    return () => list.forEach(u => URL.revokeObjectURL(u));
  }, [files]);
  return urls;
}

// 单张缩略图：依赖 File 对象本身，避免调用处新建数组导致无限重渲染
function useOneThumbUrl(file) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

function useStoredState(key, fallback) {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, value); } catch (e) { /* 隐私模式忽略 */ }
  }, [key, value]);
  return [value, setValue];
}

/* ================= 公共 UI ================= */

function Section({ num, title, children, extra }) {
  return (
    <Card size="small" className="card" title={
      <Space size={10}>
        <Tag color="blue" className="sec-num">{num}</Tag>
        <Text strong>{title}</Text>
      </Space>
    } extra={extra}>
      {children}
    </Card>
  );
}

function Field({ label, children, style }) {
  return <div className="field" style={style}><Text type="secondary" className="field-label">{label}</Text>{children}</div>;
}

function Mini({ label, children, style }) {
  return <div className="mini" style={style}><Text type="secondary" className="mini-label">{label}</Text>{children}</div>;
}

function UploadZone({ label, files, onFiles, kind }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const urls = useThumbUrls(files);
  return (
    <div
      className={`zone ${kind} ${files.length ? 'has' : ''} ${over ? 'over' : ''}`}
      onClick={() => inputRef.current && inputRef.current.click()}
      onDragEnter={e => { e.preventDefault(); setOver(true); }}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={e => { e.preventDefault(); setOver(false); }}
      onDrop={e => {
        e.preventDefault(); setOver(false);
        onFiles(sortFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))));
      }}
    >
      <svg className="up-icon" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
      <Text strong>{label}</Text>
      <Text type="secondary" style={{ fontSize: 12, marginTop: 4, wordBreak: 'break-all' }}>
        {files.length ? `已选 ${files.length} 张 · 点击重选` : '点击选择，或把照片拖进来'}
      </Text>
      <div className="thumbstrip">{urls.map((u, i) => <img key={u} src={u} alt={files[i] && files[i].name} />)}</div>
      <input
        ref={inputRef} type="file" accept="image/*" multiple
        onClick={e => e.stopPropagation()}
        onChange={e => { onFiles(sortFiles(e.target.files)); e.target.value = ''; }}
      />
    </div>
  );
}

function Status({ text, kind }) {
  if (!text) return null;
  const color = kind === 'ok' ? 'success' : kind === 'err' ? 'error' : 'processing';
  return <Tag color={color} className="status-tag">{text}</Tag>;
}

function Actions({ label, disabled, busy, status, onGenerate }) {
  return (
    <div className="actions">
      <Button type="primary" size="large" disabled={disabled} loading={busy} onClick={onGenerate}>{label}</Button>
      <Status {...status} />
    </div>
  );
}

function Entry({ title, onDelete, deleteDisabled, children }) {
  return (
    <div className="entry">
      <div className="entry-head">
        <Text strong style={{ color: '#1d4ed8' }}>{title}</Text>
        <Button type="text" danger size="small" disabled={deleteDisabled} onClick={onDelete}>删除</Button>
      </div>
      {children}
    </div>
  );
}

function Note({ children }) {
  return <Alert type="info" showIcon message={children} className="tip" />;
}

/* ================= 工具1：交办单 ================= */

function JbdTool() {
  const [date, setDate] = useState(JBD.todayStr());
  const [title, setTitle] = useStoredState('jbd_title', '骑岸居');
  const [groups, setGroups] = useState(() => [0, 1, 2].map(() => ({ before: [], after: [] })));
  const [descs, setDescs] = useState({});
  const [status, setStatus] = useState({ text: '先上传照片', kind: '' });
  const [busy, setBusy] = useState(false);

  const pairs = useMemo(() => {
    const out = [];
    groups.forEach(g => {
      const n = Math.min(g.before.length, g.after.length);
      for (let i = 0; i < n; i++) out.push({ before: g.before[i], after: g.after[i] });
    });
    return out;
  }, [groups]);

  const keyOf = p => p.before.name + '||' + p.after.name;
  const setGroupFiles = (i, key, files) =>
    setGroups(prev => prev.map((g, j) => j === i ? { ...g, [key]: files } : g));

  const counts = useMemo(() => ({
    b: groups.reduce((a, g) => a + g.before.length, 0),
    a: groups.reduce((a, g) => a + g.after.length, 0)
  }), [groups]);

  async function generate() {
    if (!pairs.length) { setStatus({ text: '请先上传照片', kind: 'err' }); return; }
    setBusy(true);
    setStatus({ text: '正在生成，请稍候…', kind: '' });
    try {
      const ps = pairs.map(p => ({ ...p, desc: descs[keyOf(p)] != null ? descs[keyOf(p)] : guessDesc(p.before.name) }));
      const blob = await JBD.generatePPT(ps, { date, title }, {
        onProgress: (i, n) => setStatus({ text: `正在处理第 ${i}/${n} 组照片…`, kind: '' })
      });
      const [, m, d] = date.split('-');
      JBD.downloadBlob(blob, `${title.trim() || '骑岸居'}${Number(m)}月${Number(d)}日 交办单.pptx`);
      setStatus({ text: `已生成 ${ps.length} 条问题，文件已开始下载`, kind: 'ok' });
    } catch (e) {
      setStatus({ text: '生成失败：' + (e.message || e), kind: 'err' });
    } finally { setBusy(false); }
  }

  return (
    <>
      <Section num="1" title="基本信息">
        <div className="row">
          <Field label="交办日期（默认今天）"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <Field label="抬头单位（自动记住）"><Input value={title} onChange={e => setTitle(e.target.value)} /></Field>
        </div>
      </Section>
      <Section num="2" title="问题照片">
        {groups.map((g, i) => (
          <Card size="small" className="group" key={i} style={{ marginBottom: 12, background: '#f8fafc' }}
            title={<Space size={8}><Tag>{i + 1}</Tag><Text strong>第 {CN[i] || (i + 1)} 组</Text></Space>}
            extra={<Button type="text" danger size="small" disabled={groups.length <= 1}
              onClick={() => setGroups(prev => prev.filter((_, j) => j !== i))}>删除本组</Button>}>
            <div className="zones">
              <UploadZone kind="b" label="整改前" files={g.before} onFiles={f => setGroupFiles(i, 'before', f)} />
              <UploadZone kind="a" label="整改后" files={g.after} onFiles={f => setGroupFiles(i, 'after', f)} />
            </div>
          </Card>
        ))}
        <Button type="dashed" block onClick={() => setGroups(prev => [...prev, { before: [], after: [] }])}>＋ 添加一组</Button>
        <div className="count">
          {!pairs.length ? '整改前 0 张、整改后 0 张'
            : counts.b !== counts.a
              ? <><Text type="warning">整改前 {counts.b} 张、整改后 {counts.a} 张，数量不一致</Text>，取较少的 <Text strong>{pairs.length}</Text> 组</>
              : <>已配对 <Text strong>{pairs.length}</Text> 组，将生成 <Text strong>{pairs.length}</Text> 条问题</>}
        </div>
        <Note>每个上传框都可以<b>一次选多张</b>：整改前选 4 张、整改后选 4 张，就会自动配成 4 组。数量不一致时按较少的配对，顺序按文件名排列。</Note>
      </Section>
      {pairs.length > 0 && (
        <Section num="3" title="问题描述">
          {pairs.map((p, i) => {
            const key = keyOf(p);
            return (
              <div className="issue" key={key + i}>
                <ThumbPair before={p.before} after={p.after} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>问题{CN[i] || (i + 1)}（可改）</Text>
                  <Input value={descs[key] != null ? descs[key] : guessDesc(p.before.name)}
                    onChange={e => setDescs(prev => ({ ...prev, [key]: e.target.value }))} />
                </div>
              </div>
            );
          })}
          <Note>描述已按文件名自动预填，可以直接改。每条问题生成一页，有几组就出几页。</Note>
        </Section>
      )}
      <Actions label="生成并下载交办单" disabled={!pairs.length} busy={busy} status={status} onGenerate={generate} />
    </>
  );
}

function ThumbPair({ before, after }) {
  const u1 = useOneThumbUrl(before);
  const u2 = useOneThumbUrl(after);
  return (
    <>
      <div className="thumb"><img src={u1} alt="整改前" /><span className="tag">整改前</span></div>
      <div className="thumb"><img src={u2} alt="整改后" /><span className="tag">整改后</span></div>
    </>
  );
}

/* ================= 工具2：安全生产隐患整改 ================= */

function SafetyTool() {
  const [form, setForm] = useState({ date: JBD.todayStr(), unit: '', addr: '', owner: '', phone: '', inspector: '' });
  const [items, setItems] = useState(() => [0, 1, 2].map(() => ({ before: [], after: [], desc: '' })));
  const [status, setStatus] = useState({ text: '先上传照片', kind: '' });
  const [busy, setBusy] = useState(false);
  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setItem = (i, patch) => setItems(prev => prev.map((it, j) => j === i ? { ...it, ...patch } : it));
  const valid = items.filter(x => x.before.length || x.after.length);

  async function generate() {
    if (!valid.length) { setStatus({ text: '请先上传照片', kind: 'err' }); return; }
    setBusy(true);
    setStatus({ text: '正在生成，请稍候…', kind: '' });
    try {
      const unit = form.unit.trim() || '被检查单位';
      const date = form.date.replace(/-/g, '.');
      const blocks = [];
      const p = (text, o) => blocks.push({ t: 'p', text, ...o });
      p('安全生产现场检查记录表', { align: 'center', bold: true, size: 16 });
      p(`被检查单位：${unit}`, { size: 12 });
      p(`地址：${form.addr.trim()}　法人代表：${form.owner.trim()}　联系电话：${form.phone.trim()}`, { size: 11 });
      p(`检查时间：${date}　检查人员：${form.inspector.trim()}`, { size: 11 });
      p('一、现场检查记录', { bold: true, size: 13, before: 160 });
      valid.forEach((it, i) => {
        p(`${i + 1}. ${it.desc || '（隐患描述）'}`, { size: 11 });
        if (it.before[0]) blocks.push({ t: 'img', file: it.before[0] });
      });
      p('二、整改方案', { bold: true, size: 13, before: 160 });
      valid.forEach((it, i) => p(`${i + 1}. 针对「${it.desc || '上述隐患'}」，责令限期整改，落实责任人，整改完成后报复查。`, { size: 11 }));
      p('三、隐患治理记录', { bold: true, size: 13, before: 160 });
      valid.forEach((it, i) => {
        p(`${i + 1}. ${it.desc || '上述隐患'} —— 已完成整改。`, { size: 11 });
        if (it.after[0]) blocks.push({ t: 'img', file: it.after[0] });
      });
      p('四、整改复查记录', { bold: true, size: 13, before: 160 });
      p(`经现场复查，上述隐患均已整改到位。复查时间：${date}。`, { size: 11 });
      p('检查人员（签名）：　　　　　　　　被检查单位负责人意见（签名）：', { size: 11, before: 200 });
      const blob = await JBD.buildDocx(blocks, { type: 'blob' });
      const [y, m, d] = form.date.split('-');
      JBD.downloadBlob(blob, `${unit}_安全隐患整改记录_${y}${m}${d}.docx`);
      setStatus({ text: `已生成 ${valid.length} 条隐患的整改记录`, kind: 'ok' });
    } catch (e) {
      setStatus({ text: '生成失败：' + (e.message || e), kind: 'err' });
    } finally { setBusy(false); }
  }

  return (
    <>
      <Section num="1" title="检查信息">
        <div className="row">
          <Field label="检查日期（默认今天）"><Input type="date" value={form.date} onChange={e => setField('date', e.target.value)} /></Field>
          <Field label="被检查单位"><Input value={form.unit} placeholder="如：南通俊美服饰有限公司" onChange={e => setField('unit', e.target.value)} /></Field>
          <Field label="地址"><Input value={form.addr} placeholder="如：骑岸居8组" onChange={e => setField('addr', e.target.value)} /></Field>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <Field label="法人代表"><Input value={form.owner} onChange={e => setField('owner', e.target.value)} /></Field>
          <Field label="联系电话"><Input value={form.phone} onChange={e => setField('phone', e.target.value)} /></Field>
          <Field label="检查人员"><Input value={form.inspector} placeholder="多人用顿号分隔" onChange={e => setField('inspector', e.target.value)} /></Field>
        </div>
      </Section>
      <Section num="2" title="隐患条目">
        {items.map((it, i) => (
          <Entry key={i} title={`隐患 ${i + 1}`} deleteDisabled={items.length <= 1}
            onDelete={() => setItems(prev => prev.filter((_, j) => j !== i))}>
            <Mini label="隐患描述 / 检查情况">
              <Input.TextArea rows={2} style={{ marginTop: 5 }} value={it.desc}
                placeholder="如：灭火器没有成对放置"
                onChange={e => setItem(i, { desc: e.target.value })} />
            </Mini>
            <div className="zones" style={{ marginTop: 10 }}>
              <UploadZone kind="b" label="整改前照片" files={it.before} onFiles={f => setItem(i, { before: f })} />
              <UploadZone kind="a" label="整改后照片" files={it.after} onFiles={f => setItem(i, { after: f })} />
            </div>
          </Entry>
        ))}
        <Button type="dashed" block onClick={() => setItems(prev => [...prev, { before: [], after: [], desc: '' }])}>＋ 添加一条隐患</Button>
        <Note>每条隐患可配一组整改前后照片，生成一份 Word 文档，含现场检查记录、整改方案、隐患治理记录、整改复查记录四部分。</Note>
      </Section>
      <Actions label="生成并下载隐患整改记录" disabled={!valid.length} busy={busy} status={status} onGenerate={generate} />
    </>
  );
}

/* ================= 应用 ================= */

const TABS = [
  { id: 'jbd', label: '交办单', Comp: JbdTool },
  { id: 'safety', label: '安全隐患整改', Comp: SafetyTool }
];

function App() {
  const [tab, setTab] = useStoredState('jbd_active_tab', 'jbd');
  const active = TABS.some(t => t.id === tab) ? tab : 'jbd';
  return (
    <ConfigProvider locale={zhCN} theme={{
      token: { colorPrimary: '#2563eb', borderRadius: 8, fontSize: 14, colorBgLayout: '#f4f6f9' }
    }}>
      <header><div className="wrap">
        <Title level={3} style={{ color: '#fff', margin: 0 }}>骑岸居 · 工作工具箱</Title>
        <Text style={{ color: 'rgba(255,255,255,.86)', fontSize: 13 }}>本地处理 · 不上传服务器 · 随手生成上报文件</Text>
      </div></header>
      <div className="tabs-wrap">
        <Tabs activeKey={active} onChange={setTab} items={TABS.map(t => ({ key: t.id, label: t.label }))} />
      </div>
      <main>
        {/* 所有工具始终挂载，切换标签只切换可见性，避免丢失已填数据 */}
        {TABS.map(t => {
          const Tool = t.Comp;
          return (
            <div className={'panel' + (active === t.id ? '' : ' hidden')} key={t.id}>
              <Tool />
            </div>
          );
        })}
        <div className="footer">所有数据只在你的浏览器本地处理，不会上传到任何服务器。生成的文件可直接用 WPS 打开编辑。</div>
      </main>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
