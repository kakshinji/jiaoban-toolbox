/* ==== 共用：前端生成 xlsx / docx（纯 JSZip，无外部模板） ==== */

function xmlEsc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function colName(n){
  let s=''; n = n|0;
  while(n>0){ n--; s = String.fromCharCode(65 + n%26) + s; n = Math.floor(n/26); }
  return s;
}

/* ---------- 简易 XLSX（inlineStr，多 sheet，含基础样式） ---------- */
async function buildXlsx(sheets, opt){
  opt = opt || {};
  const files = {};
  const T = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const ctTypes = [
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
  ];
  sheets.forEach((s,i)=>ctTypes.push(`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`));
  files['[Content_Types].xml'] = T + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${ctTypes.join('')}</Types>`;
  files['_rels/.rels'] = T + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';

  const wbSheets = sheets.map((s,i)=>`<sheet name="${xmlEsc(s.name.replace(/[\\/?*\[\]:]/g,'_').slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('');
  files['xl/workbook.xml'] = T + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${wbSheets}</sheets></workbook>`;
  files['xl/_rels/workbook.xml.rels'] = T + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('') +
    `<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>';

  files['xl/styles.xml'] = T + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <fonts count="3"><font><sz val="11"/><name val="宋体"/></font><font><b/><sz val="14"/><name val="宋体"/></font><font><b/><sz val="11"/><name val="宋体"/></font></fonts>
    <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF7"/><bgColor indexed="64"/></patternFill></fill></fills>
    <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right><top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom><diagonal/></border></borders>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="4">
      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
      <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
      <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    </cellXfs>
  </styleSheet>`;

  sheets.forEach((sh,si)=>{
    const rows = sh.rows || [];
    const widths = sh.widths || [];
    const cols = widths.length ? `<cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    let body = '';
    rows.forEach((row,ri)=>{
      let cells = '';
      const arr = Array.isArray(row) ? row : [];
      arr.forEach((val,ci)=>{
        if(val == null || val === '') return;
        const ref = colName(ci+1) + (ri+1);
        let style = 3;
        if(sh.titleRow === ri) style = 1;
        else if(sh.headerRow === ri) style = 2;
        const isNum = typeof val === 'number' && isFinite(val);
        cells += isNum
          ? `<c r="${ref}" s="${style}"><v>${val}</v></c>`
          : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(val)}</t></is></c>`;
      });
      const h = (sh.rowHeights && sh.rowHeights[ri]) ? ` ht="${sh.rowHeights[ri]}" customHeight="1"` : '';
      body += `<row r="${ri+1}"${h}>${cells}</row>`;
    });
    const merge = (sh.merges||[]).map(m=>`<mergeCell ref="${m}"/>`).join('');
    files[`xl/worksheets/sheet${si+1}.xml`] = T + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData>${merge ? `<mergeCells count="${(sh.merges||[]).length}">${merge}</mergeCells>` : ''}</worksheet>`;
  });

  const zip = new JSZip();
  Object.keys(files).forEach(k => zip.file(k, files[k]));
  return await zip.generateAsync({type: opt.type || 'blob', compression:'DEFLATE', compressionOptions:{level:6}});
}

/* ---------- 简易 DOCX（含嵌入照片） ---------- */
async function buildDocx(blocks, opt){
  opt = opt || {};
  const T = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const media = [];
  let body = '';

  function para(text, o){
    o = o || {};
    const align = o.align ? `<w:jc w:val="${o.align}"/>` : '';
    const bold = o.bold ? '<w:b/>' : '';
    const sz = o.size ? `<w:sz w:val="${o.size*2}"/><w:szCs w:val="${o.size*2}"/>` : '';
    const before = o.before != null ? `<w:spacing w:before="${o.before}"/>` : '';
    return `<w:p><w:pPr>${align}${before}</w:pPr><w:r><w:rPr>${bold}${sz}<w:rFonts w:eastAsia="宋体" w:ascii="宋体"/></w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
  }
  function table(rows, widths){
    let xml = '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' +
      ['top','left','bottom','right','insideH','insideV'].map(k=>`<w:${k} w:val="single" w:sz="4" w:color="808080"/>`).join('') +
      '</w:tblBorders></w:tblPr><w:tblGrid>' +
      (widths||rows[0].map(()=>2400)).map(w=>`<w:gridCol w:w="${w}"/>`).join('') + '</w:tblGrid>';
    rows.forEach((row,ri)=>{
      xml += '<w:tr>';
      row.forEach(cell=>{
        const txt = String(cell == null ? '' : cell).replace(/\n/g,' ');
        xml += `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="宋体"/></w:rPr><w:t xml:space="preserve">${xmlEsc(txt)}</w:t></w:r></w:p></w:tc>`;
      });
      xml += '</w:tr>';
    });
    return xml + '</w:tbl>';
  }
  function picture(file, maxW){
    return new Promise(async resolve=>{
      try{
        const dataUrl = await fileToDataUrl(file, maxW || 900);
        const b64 = dataUrl.split(',')[1];
        const name = 'img' + (media.length+1) + '.jpeg';
        media.push({name, b64});
        const id = media.length;
        const cx = 360000 * 12, cy = 360000 * 7;
        resolve(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
      }catch(e){ resolve(para('[照片读取失败: '+(e.message||e)+']')); }
    });
  }

  for(const b of blocks){
    if(b.t === 'p') body += para(b.text, b);
    else if(b.t === 'table') body += table(b.rows, b.widths);
    else if(b.t === 'img') body += await picture(b.file, b.maxW);
    else if(b.t === 'page') body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    else if(b.t === 'space') body += para('', {before: b.h || 120});
  }

  const doc = T + `<w:document ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1000" w:bottom="1200" w:left="1000"/></w:sectPr></w:body></w:document>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', T + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file('_rels/.rels', T + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', doc);
  let rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  media.forEach((m,i)=>{ rels += `<Relationship Id="rIdImg${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`; });
  zip.file('word/_rels/document.xml.rels', T + rels + '</Relationships>');
  media.forEach(m => zip.file('word/media/'+m.name, m.b64, {base64:true}));
  return await zip.generateAsync({type: opt.type || 'blob', compression:'DEFLATE', compressionOptions:{level:6}});
}

/* 照片压缩为 JPEG dataURL（浏览器 Canvas） */
function fileToDataUrl(file, maxW){
  return new Promise((resolve,reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      try{
        const scale = Math.min(1, (maxW||900)/img.width);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width*scale));
        c.height = Math.max(1, Math.round(img.height*scale));
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height);
        ctx.drawImage(img,0,0,c.width,c.height);
        const out = c.toDataURL('image/jpeg', 0.78);
        URL.revokeObjectURL(url);
        resolve(out);
      }catch(e){ URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('照片读取失败')); };
    img.src = url;
  });
}

function downloadBlob(blob, filename){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 30000);
}

function todayStr(){
  const d = new Date(), p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
