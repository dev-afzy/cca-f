import "server-only";
import fs from "node:fs";
import path from "node:path";

const SKILLS_DIR = path.join(process.cwd(), ".claude", "skills");

type SkillBundle = {
  skillMd: string;
  pedagogyMd: string;
  curriculumMd: string;
  questionBankMd: string;
};

let _bundle: SkillBundle | null = null;

function readSkillFile(name: string): string {
  return fs.readFileSync(path.join(SKILLS_DIR, name), "utf8");
}

export function getSkillBundle(): SkillBundle {
  if (_bundle) return _bundle;
  _bundle = {
    skillMd: readSkillFile("SKILL.md"),
    pedagogyMd: readSkillFile("pedagogy.md"),
    curriculumMd: readSkillFile("curriculum.md"),
    questionBankMd: readSkillFile("question-bank.md"),
  };
  return _bundle;
}

export function getCurriculumHour(hour: number): string {
  const { curriculumMd } = getSkillBundle();
  // Find the ## Hour N section (or ## Hour N — ... variant)
  const lines = curriculumMd.split("\n");
  const headingRegex = /^### Hour \d+/;
  const targetRegex = new RegExp(`^### Hour ${hour}(\\s|$|\\s—)`);

  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    if (targetRegex.test(line)) {
      inSection = true;
      sectionLines.push(line);
      continue;
    }
    if (inSection) {
      // Stop at the next H3 heading
      if (headingRegex.test(line)) break;
      sectionLines.push(line);
    }
  }

  if (sectionLines.length === 0) {
    return `## Hour ${hour}\n\n_No curriculum entry found for hour ${hour}._`;
  }
  return sectionLines.join("\n");
}

export function getDiagnosticBattery(): string {
  const { pedagogyMd } = getSkillBundle();
  const marker = "## 2. The Diagnostic Battery";
  const nextSection = "## 3. Diagnostic Rubrics";
  const start = pedagogyMd.indexOf(marker);
  if (start === -1) return "";
  const end = pedagogyMd.indexOf(nextSection, start);
  if (end === -1) return pedagogyMd.slice(start);
  return pedagogyMd.slice(start, end);
}
