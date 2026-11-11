import { Eye, Link, Lock, Play } from "lucide-react";
import { SiGithub } from "react-icons/si";
import { Chrome, Demo, Mark } from "@/components/demo";

const REPO = "https://github.com/Subjective/watch-together";
const INSTALL = `${REPO}/releases`;

const FACTS = [
  {
    icon: (
      <Play className="fill-current" style={{ color: "var(--green-600)" }} />
    ),
    title: "Shared controls",
    text: "Pause, rewind or skip, and everyone follows.",
  },
  {
    icon: <Lock style={{ color: "var(--amber)" }} />,
    title: "Host only",
    text: "Lock it so only you can pause and skip.",
  },
  {
    icon: <Eye />,
    title: "Next episode",
    text: "When the host moves on, everyone comes along.",
  },
  {
    icon: <Link />,
    title: "Easy invites",
    text: "Send a link and friends join right in.",
  },
];

const SITES = ["Netflix", "YouTube", "Prime Video", "Disney+", "Hulu", "Max"];

export default function Home() {
  return (
    <div className="wrap">
      <nav>
        <a className="brand" href="#">
          <Mark size={28} />
          Watch Together
        </a>
        <a className="icon" href={REPO} aria-label="GitHub" title="GitHub">
          <SiGithub />
        </a>
        <a className="cta small" href={INSTALL}>
          <Chrome />
          Add to Chrome
        </a>
      </nav>

      <section className="hero">
        <h1>Watch together.</h1>
        <p className="lede">
          Stream shows and movies with friends, perfectly in sync.
        </p>
        <a className="cta" href={INSTALL}>
          <Chrome />
          Add to Chrome
          <span className="tag">Free</span>
        </a>
      </section>

      <Demo>
        <div className="facts">
          {FACTS.map((fact) => (
            <div className="fact" key={fact.title}>
              <span className="icon">{fact.icon}</span>
              <b>{fact.title}</b>
              <span>{fact.text}</span>
            </div>
          ))}
        </div>
      </Demo>

      <p className="sites">
        Works on{" "}
        {SITES.map((site, index) => (
          <span key={site}>
            <b>{site}</b>
            {index < SITES.length - 1 ? ", " : ""}
          </span>
        ))}{" "}
        and most other sites with a video player.
      </p>

      <footer>
        <span>© 2026 Watch Together</span>
        <a href={REPO}>GitHub</a>
      </footer>
    </div>
  );
}
