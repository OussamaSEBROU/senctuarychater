
export const translations = {
  en: {
    title: "KNOWLEDGE AI",
    sanctuary: "Sanctuary",
    introText: "Neural extraction of axiomatic wisdom from deep manuscripts",
    upload: "Upload Manuscript",
    uploadDesc: "PDF manuscripts only",
    newSanctuary: "New Sanctuary",
    axiomsTitle: "Knowledge Axioms",
    dialogue: "The Dialogue",
    dialogueDesc: "Interrogate the text's deeper essence through the neural sanctuary.",
    language: "Language",
    viewer: "Manuscript Viewer",
    synthesis: "Neural Synthesis...",
    covenant: "The Sanctuary Covenant: Direct reading and personal comprehension are the only paths to wisdom.",
    about: "About Us",
    help: "Help",
    // Fix: Added missing keys aboutText and helpText
    aboutText: "We are an elite neural research collective dedicated to the extraction of axiomatic truths from historical manuscripts.",
    helpText: "Upload a PDF manuscript to begin. The system will extract core axioms, which you can then explore through a deep neural dialogue.",
    placeholder: "Interrogate the author's logic...",
    deepChatBtn: "Deep Knowledge Chat",
    // Fix: Corrected language instruction in extraction prompt
    extractionPrompt: (lang: string) => `Extract 6 core 'Knowledge Axioms' from this manuscript. The entire response must be in English. Each axiom should include a profound term, a scholarly definition, and its overarching significance.`
  },
  ar: {
    title: "محراب المعرفة",
    sanctuary: "المحراب",
    introText: "استخراج عصبي للحكمة البديهية من أعماق المخطوطات والكتب",
    upload: "رفع المخطوطة",
    uploadDesc: "ملفات PDF فقط",
    newSanctuary: "محراب جديد",
    axiomsTitle: "البديهيات المعرفية",
    dialogue: "الحوار المعرفي",
    dialogueDesc: "استجوب الجوهر العميق للنص من خلال المحراب العصبي.",
    language: "اللغة",
    viewer: "عرض المخطوطة",
    synthesis: "توليف عصبي جارٍ...",
    covenant: "ميثاق المحراب: القراءة المباشرة والاستيعاب الشخصي هما المساران الوحيدان للحكمة.",
    about: "من نحن",
    help: "المساعدة",
    // Fix: Added missing keys aboutText and helpText
    aboutText: "نحن مجموعة بحثية نخبوية مكرسة لاستخراج الحقائق البديهية من المخطوطات التاريخية باستخدام الذكاء الاصطناعي.",
    helpText: "قم برفع مخطوطة بصيغة PDF للبدء. سيقوم النظام باستخراج البديهيات الأساسية، والتي يمكنك استكشافها بعمق من خلال حوار عصبي.",
    placeholder: "استجوب منطق المؤلف... (Interrogate Logic)",
    deepChatBtn: "حوار المعرفة العميقة",
    extractionPrompt: (lang: string) => `استخرج 6 'بديهيات معرفية' أساسية من هذه المخطوطة. يجب أن تكون الاستجابة كاملة باللغة العربية. يجب أن تتضمن كل بديهية مصطلحاً عميقاً، تعريفاً أكاديمياً، وأهميتها الشاملة.`
  }
};
