import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, BookOpen, ChartNoAxesColumn, Download, Plug, SquarePen } from 'lucide-react';
import { Button } from './Button.jsx';
import Docs from './Docs.jsx';
import './style.css';

const repo = 'https://github.com/yash55-sop/KAFENE';
const download = repo + '/releases/latest/download/Kafene-Setup.exe';

function Brand() {
  return <a className="brand" href="/"><img src="/coffee.svg" width="34" height="34" alt="" />Kafene</a>;
}

function Home() {
  return <>
    <section className="hero wrap">
      <div>
        <p className="eyebrow">Windows desktop workspace</p>
        <h1>Your work stays<br className="wide-break" /> with you.</h1>
        <p className="intro">Write notes, organize projects, and build databases in a workspace that lives on your computer. Connect a coding agent when you need a hand.</p>
        <div className="actions">
          <Button asChild><a href={download}><Download size={17} /> Download for Windows</a></Button>
          <Button asChild variant="outline"><a href="/docs/"><BookOpen size={17} /> MCP setup</a></Button>
        </div>
        <p className="platform">Windows · 64-bit</p>
      </div>
      <figure className="preview" aria-label="Illustration of a Kafene project dashboard">
        <div className="preview-top"><img src="/coffee.svg" width="25" height="25" alt="" /> Kafene <span>Workspace</span></div>
        <div className="preview-body">
          <p className="preview-path">Projects / Launch plan</p>
          <h2>Launch plan</h2>
          <div className="preview-tabs"><span>Table view</span><span>Progress</span></div>
          <div className="preview-chart" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          <div className="preview-row"><span>✓</span> Draft onboarding <small>Done</small></div>
          <div className="preview-row"><span>◦</span> Review release notes <small>In progress</small></div>
        </div>
      </figure>
    </section>
    <section className="features wrap" aria-label="What you can do in Kafene">
      <article><SquarePen /><h2>Notes and whiteboards</h2><p>Sketch ideas and keep project notes in the same local workspace.</p></article>
      <article><ChartNoAxesColumn /><h2>Databases and charts</h2><p>Turn rows into bar, line, donut, or number charts from the slash menu.</p></article>
      <article><Plug /><h2>Local MCP connection</h2><p>Let a compatible coding agent read pages and make editable changes through Kafene’s local tools.</p><a href="/docs/">Open setup guide <ArrowUpRight size={15} /></a></article>
    </section>
  </>;
}

function App() {
  const docs = /^\/docs(?:\/|$)/.test(location.pathname);
  return <>
    <header className="site-header"><div className="wrap nav"><Brand /><nav aria-label="Main navigation"><a href="/docs/" aria-current={docs ? 'page' : undefined}>Docs</a><Button asChild variant="outline"><a href={download}>Download <Download size={15} /></a></Button></nav></div></header>
    <main>{docs ? <Docs /> : <Home />}</main>
    <footer className="wrap footer"><Brand /><a href={repo + '/releases'}>Releases <ArrowUpRight size={15} /></a></footer>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
