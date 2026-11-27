

const CN = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五'];
// 页面 25.4 x 19.05 cm；照片区放大到约 11.3cm 高，标签下方到页脚上方
const IMG_BOXES = [
  [360000, 2300000, 4060000, 4070000],
  [4752000, 2300000, 4060000, 4070000]
];
const RIGHT_X = 6000000;

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function ab64(buf){
  const bytes = new Uint8Array(buf); let s = '';
  const chunk = 0x8000;
  for(let i=0;i<bytes.length;i+=chunk) s += String.fromCharCode.apply(null, bytes.subarray(i,i+chunk));
  return btoa(s);
}

function fitBox(pw, ph, box){
  const [bx,by,bw,bh] = box;
  if(pw<=0||ph<=0) return [bx,by,bw,bh];
  const ratio = pw/ph, boxRatio = bw/bh;
  let w,h;
  if(ratio>=boxRatio){ w=bw; h=Math.round(bw/ratio); }
  else { h=bh; w=Math.round(bh*ratio); }
  return [Math.round(bx+(bw-w)/2), Math.round(by+(bh-h)/2), w, h];
}

function setProblemText(xml, text){
  const re = /<p:sp>(?:(?!<\/p:sp>)[\s\S])*?sz="4000"(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/;
  const m = xml.match(re);
  if(!m) return xml;
  let seg = m[0];
  const rm = seg.match(/<a:rPr[^>]*>[\s\S]*?<\/a:rPr>|<a:rPr[^>]*\/>/);
  const rpr = rm ? rm[0] : '<a:rPr lang="zh-CN" sz="4000"/>';
  seg = seg.replace(/<a:r>[\s\S]*?<\/a:r>/g,'');
  seg = seg.replace('</a:p>', `<a:r>${rpr}<a:t>${esc(text)}</a:t></a:r></a:p>`);
  const xf = seg.match(/<a:off x="(\d+)" y="(\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  if(xf){
    const x=+xf[1], y=+xf[2], cy=xf[4];
    const want = Math.max(+xf[3], RIGHT_X - x - 91440);
    seg = seg.replace(xf[0], `<a:off x="${x}" y="${y}"/><a:ext cx="${want}" cy="${cy}"/>`);
  }
  seg = seg.replace(/<a:bodyPr([^>]*?)\s*\/>/, '<a:bodyPr$1><a:normAutofit/></a:bodyPr>');
  xml = xml.replace(m[0], seg);
  const re2 = /<p:sp>(?:(?!<\/p:sp>)[\s\S])*?sz="(?:2000|2800)"(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g;
  xml = xml.replace(re2, s2 => {
    const txt = [...s2.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(t=>t[1]).join('').trim();
    return (!txt || txt.includes('整改')) ? s2 : s2.replace(/<a:r>[\s\S]*?<\/a:r>/g,'');
  });
  return xml;
}

// 把「整改前/整改后」标签移到各自照片框正上方
function centerLabels(xml){
  for(const [txt,box] of [['整改前',IMG_BOXES[0]],['整改后',IMG_BOXES[1]]]){
    const re = new RegExp('<p:sp>(?:(?!<\\/p:sp>)[\\s\\S])*?'+txt+'(?:(?!<\\/p:sp>)[\\s\\S])*?<\\/p:sp>');
    xml = xml.replace(re, seg => {
      const cx = box[0] + box[2]/2;
      const m = seg.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
      if(m){
        const nx = Math.round(cx - 685800);
        seg = seg.replace(m[0], `<a:off x="${nx}" y="${m[2]}"/>`);
      }
      return seg;
    });
  }
  return xml;
}

function applyPics(xml, imgs){
  const ms = [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)];
  ms.sort((a,b)=>{
    const x = m => +((m[0].match(/<a:off x="(-?\d+)"/)||[])[1]||0);
    return x(a)-x(b);
  });
  let out = xml;
  for(let k=0;k<2 && k<ms.length;k++){
    const old = ms[k][0]; let seg = old;
    const im = imgs[k];
    seg = seg.replace(/r:embed="[^"]*"/, `r:embed="rIdImg${k+1}"`);
    seg = seg.replace(/<a:off x="-?\d+" y="-?\d+"\/>/, `<a:off x="${im[0]}" y="${im[1]}"/>`);
    seg = seg.replace(/<a:ext cx="\d+" cy="\d+"\/>/, `<a:ext cx="${im[2]}" cy="${im[3]}"/>`);
    if(old !== seg) out = out.replace(old, seg);
  }
  return out;
}

function setRels(rels, i){
  rels = rels.replace(/<Relationship\b[^>]*Type="[^"]*\/image"[^>]*\/>/g,'');
  const t = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
  const a = `../media/jbd_${2*i+1}.jpg`, b = `../media/jbd_${2*i+2}.jpg`;
  return rels.replace('</Relationships>',
    `<Relationship Id="rIdImg1" Type="${t}" Target="${a}"/>`+
    `<Relationship Id="rIdImg2" Type="${t}" Target="${b}"/>`+
    '</Relationships>');
}

async function cloneSlide(zip, idx){
  let pres = await zip.file('ppt/presentation.xml').async('string');
  let prels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  const ids = [...pres.matchAll(/<p:sldId id="(\d+)"/g)].map(m=>+m[1]);
  const newId = Math.max(...ids)+1;
  const rids = [...prels.matchAll(/Id="(rId\d+)"/g)].map(m=>m[1]);
  let k=1; while(rids.includes('rId'+k)) k++;
  const newRid = 'rId'+k;
  pres = pres.replace('</p:sldIdLst>', `<p:sldId id="${newId}" r:id="${newRid}"/></p:sldIdLst>`);
  prels = prels.replace('</Relationships>',
    `<Relationship Id="${newRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${idx}.xml"/></Relationships>`);
  zip.file('ppt/presentation.xml', pres);
  zip.file('ppt/_rels/presentation.xml.rels', prels);
  let ct = await zip.file('[Content_Types].xml').async('string');
  ct = ct.replace('</Types>',
    `<Override PartName="/ppt/slides/slide${idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
  zip.file('[Content_Types].xml', ct);
}

function setCoverDate(xml, y, m, d){
  const ts = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)];
  const rep = {2:String(y), 4:String(m), 6:String(d)};
  let out = xml;
  for(let i=ts.length-1;i>=0;i--) if(i in rep) out = out.replace(ts[i][0], `<a:t>${rep[i]}</a:t>`);
  return out;
}

async function imageSize(file){
  if(file && file.__w && file.__h) return [file.__w, file.__h];
  const bmp = await createImageBitmap(file);
  const r = [bmp.width, bmp.height];
  bmp.close && bmp.close();
  return r;
}

// pairs: [{before:File, after:File, desc:String}]
// meta:  {date:'YYYY-MM-DD', title:'骑岸居'}
async function generatePPT(pairs, meta, opt){
  opt = opt || {};
  if(!pairs.length) throw new Error('没有可生成的照片组');
  const [ys,ms,ds] = String(meta.date||'').split('-').map(Number);
  if(!ys||!ms||!ds) throw new Error('请选择交办日期');
  const title = (meta.title||'骑岸居').trim() || '骑岸居';
  const zip = await JSZip.loadAsync(TEMPLATE_B64, {base64:true});

  let s2 = await zip.file('ppt/slides/slide2.xml').async('string');
  zip.file('ppt/slides/slide2.xml', setCoverDate(s2, ys, ms, ds));
  let s1 = await zip.file('ppt/slides/slide1.xml').async('string');
  zip.file('ppt/slides/slide1.xml', s1.replace(/骑岸居/g, esc(title)));

  const baseXml = await zip.file('ppt/slides/slide3.xml').async('string');
  const baseRels = await zip.file('ppt/slides/_rels/slide3.xml.rels').async('string');
  const withLabels = centerLabels(baseXml);

  for(let i=0;i<pairs.length;i++){
    const idx = 3+i;
    if(idx>3) await cloneSlide(zip, idx);
    let xml = withLabels;
    xml = setProblemText(xml, `问题${CN[i]||(i+1)}：${pairs[i].desc||'路边垃圾'}`);

    const imgs = [];
    for(const [file,box] of [[pairs[i].before,IMG_BOXES[0]],[pairs[i].after,IMG_BOXES[1]]]){
      const [pw,ph] = await imageSize(file);
      imgs.push(fitBox(pw,ph,box));
    }
    xml = applyPics(xml, imgs);

    for(const [file,k] of [[pairs[i].before,1],[pairs[i].after,2]]){
      const b64 = ab64(await file.arrayBuffer());
      zip.file(`ppt/media/jbd_${2*i+k}.jpg`, b64, {base64:true});
    }
    zip.file(`ppt/slides/slide${idx}.xml`, xml);
    zip.file(`ppt/slides/_rels/slide${idx}.xml.rels`, setRels(baseRels, i));
    if(opt.onProgress) opt.onProgress(i+1, pairs.length);
    if(typeof setTimeout === 'function') await new Promise(r=>setTimeout(r,0));
  }
  return await zip.generateAsync({
    type: opt.type || 'blob',
    compression: 'DEFLATE',
    compressionOptions: {level:6}
  });
}

