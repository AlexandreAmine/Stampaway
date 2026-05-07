import { LegalDocument } from "@/components/LegalDocument";
import { useLanguage } from "@/contexts/LanguageContext";
import terms from "@/i18n/legal/terms.json";

type LegalDoc = { title: string; lastUpdated: string; html: string };
const docs = terms as Record<string, LegalDoc>;

export default function TermsOfServicePage() {
  const { language } = useLanguage();
  const d = docs[language] || docs.en;
  return (
    <LegalDocument title={d.title} lastUpdated={d.lastUpdated}>
      <div dangerouslySetInnerHTML={{ __html: d.html }} />
    </LegalDocument>
  );
}
