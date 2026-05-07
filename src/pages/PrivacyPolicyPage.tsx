import { LegalDocument } from "@/components/LegalDocument";
import { useLanguage } from "@/contexts/LanguageContext";
import privacy from "@/i18n/legal/privacy.json";

type LegalDoc = { title: string; lastUpdated: string; html: string };
const docs = privacy as Record<string, LegalDoc>;

export default function PrivacyPolicyPage() {
  const { language } = useLanguage();
  const d = docs[language] || docs.en;
  return (
    <LegalDocument title={d.title} lastUpdated={d.lastUpdated}>
      <div dangerouslySetInnerHTML={{ __html: d.html }} />
    </LegalDocument>
  );
}
