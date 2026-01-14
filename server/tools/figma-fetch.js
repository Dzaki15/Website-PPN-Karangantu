#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const ROOT = path.join(process.cwd());
const TOKEN_PATH = path.join(ROOT, '.figma_token');
const FILE_PATH = path.join(ROOT, '.figma_fileid');

function readFileIfExists(p){
  try{ return fs.readFileSync(p,'utf8').trim(); }catch(e){ return null; }
}

function colorToHex(c, opacity){
  const r = Math.round((c.r||0)*255);
  const g = Math.round((c.g||0)*255);
  const b = Math.round((c.b||0)*255);
  const hex = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`.toUpperCase();
  if(opacity === undefined || opacity === 1 || opacity === null) return hex;
  const a = Math.round((opacity)*255);
  const ah = a.toString(16).padStart(2,'0').toUpperCase();
  return hex + ah; // return #RRGGBBAA
}

function collectFromNode(node, colorsSet, fontsSet){
  if(!node || typeof node !== 'object') return;
  // fills
  if(Array.isArray(node.fills)){
    for(const f of node.fills){
      if(!f) continue;
      if(f.type === 'SOLID' && f.color){
        colorsSet.add(colorToHex(f.color, f.opacity));
      }
      if(f.imageRef && f.type === 'IMAGE'){
        // image references ignored for now
      }
    }
  }
  // style on text
  if(node.type === 'TEXT'){
    if(node.style){
      if(node.style.fontFamily) fontsSet.add(node.style.fontFamily);
      if(node.style.fontPostScriptName) fontsSet.add(node.style.fontPostScriptName);
    }
    if(node.style && node.style.fill && node.style.fill.color) colorsSet.add(colorToHex(node.style.fill.color, node.style.fill.opacity));
  }
  // explicit style object
  if(node.styles && typeof node.styles === 'object'){
    for(const k of Object.values(node.styles)){
      if(k && typeof k === 'string'){
        // style keys are handled via /styles endpoint
      }
    }
  }
  // recurse
  if(Array.isArray(node.children)){
    for(const c of node.children) collectFromNode(c, colorsSet, fontsSet);
  }
}

async function main(){
  const token = process.env.FIGMA_TOKEN || readFileIfExists(TOKEN_PATH);
  const fileKey = process.env.FIGMA_FILE || readFileIfExists(FILE_PATH);
  if(!token){
    console.error('Missing Figma token. Set FIGMA_TOKEN env or place token in', TOKEN_PATH);
    process.exit(1);
  }
  if(!fileKey){
    console.error('Missing Figma file key. Set FIGMA_FILE env or place file key in', FILE_PATH);
    process.exit(1);
  }
  const headers = { 'X-Figma-Token': token };
  console.log('Fetching styles and file document from Figma...');
  const stylesRes = await fetch(`https://api.figma.com/v1/files/${fileKey}/styles`, { headers });
  if(!stylesRes.ok){ console.error('Failed to fetch styles:', stylesRes.status, await stylesRes.text()); process.exit(1); }
  const stylesJson = await stylesRes.json();

  const fileRes = await fetch(`https://api.figma.com/v1/files/${fileKey}`, { headers });
  if(!fileRes.ok){ console.error('Failed to fetch file:', fileRes.status, await fileRes.text()); process.exit(1); }
  const fileJson = await fileRes.json();

  const colorsSet = new Set();
  const fontsSet = new Set();

  collectFromNode(fileJson.document, colorsSet, fontsSet);

  // also inspect styles endpoint for color/text styles
  if(stylesJson.meta && Array.isArray(stylesJson.meta)){
    // older schema - ignore
  }
  if(Array.isArray(stylesJson.meta?.styles)){
    for(const s of stylesJson.meta.styles){
      if(s.style_type === 'FILL' && s.description){
        // no direct color value: ignoring
      }
    }
  }
  // Fallback: if styles key present
  if(Array.isArray(stylesJson.styles)){
    for(const s of stylesJson.styles){
      if(s.style_type === 'TEXT' && s.node_id){
        fontsSet.add(s.name);
      }
    }
  }

  const audit = {
    fileKey,
    title: fileJson.name,
    colors: Array.from(colorsSet).slice(0,50),
    fonts: Array.from(fontsSet).slice(0,50),
    styles: stylesJson
  };

  const outPath = path.join(process.cwd(), 'figma-audit.json');
  fs.writeFileSync(outPath, JSON.stringify(audit, null, 2), 'utf8');
  console.log('Wrote', outPath);
  console.log('Summary:');
  console.log('Title:', audit.title);
  console.log('Colors found:', audit.colors.join(', '));
  console.log('Fonts found:', audit.fonts.join(', '));
}

main().catch(err => { console.error(err); process.exit(1); });
