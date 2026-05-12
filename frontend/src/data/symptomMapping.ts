export type Symptom = { id: string; label: string; icon: string; }

export const ZONE_SYMPTOMS: Record<string, Symptom[]> = {
  Head: [
    { id: 'headache',  label: 'Headache',        icon: '🤕' },
    { id: 'fever',     label: 'Fever',            icon: '🔥' },
    { id: 'dizziness', label: 'Dizziness',        icon: '🌀' },
    { id: 'vision',    label: 'Blurry Vision',    icon: '👁️' },
    { id: 'vomit',     label: 'Vomiting',         icon: '🤮' },
    { id: 'speech',    label: 'Speech Issue',      icon: '🗣️' },
  ],
  Chest: [
    { id: 'breathless',  label: 'Breathlessness', icon: '🫁' },
    { id: 'tightness',   label: 'Chest Pain',     icon: '💔' },
    { id: 'palpitation', label: 'Palpitations',   icon: '💓' },
    { id: 'cough',       label: 'Cough',          icon: '🤧' },
    { id: 'heartburn',   label: 'Heartburn',      icon: '🔥' },
  ],
  Stomach: [
    { id: 'cramps',    label: 'Severe Cramps',   icon: '🔪' },
    { id: 'nausea',    label: 'Nausea',          icon: '🤢' },
    { id: 'bloating',  label: 'Bloating',        icon: '🎈' },
    { id: 'diarrhea',  label: 'Diarrhoea',       icon: '🚽' },
    { id: 'appetite',  label: 'No Appetite',     icon: '🥣' },
  ],
  'Right Arm': [
    { id: 'numbness',  label: 'Numbness',        icon: '🧊' },
    { id: 'swelling',  label: 'Swelling',        icon: '🎈' },
    { id: 'fracture',  label: 'Fracture/Break',  icon: '🦴' },
    { id: 'weakness',  label: 'Weakness',        icon: '💪' },
  ],
  'Left Arm': [
    { id: 'numbness',  label: 'Numbness',        icon: '🧊' },
    { id: 'swelling',  label: 'Swelling',        icon: '🎈' },
    { id: 'fracture',  label: 'Fracture/Break',  icon: '🦴' },
    { id: 'weakness',  label: 'Weakness',        icon: '💪' },
  ],
  'Right Leg': [
    { id: 'noWalk',    label: "Can't Walk",      icon: '🩼' },
    { id: 'joint',     label: 'Joint Pain',      icon: '🦵' },
    { id: 'cramping',  label: 'Cramping',        icon: '🪢' },
    { id: 'wound',     label: 'Open Wound',      icon: '🩸' },
  ],
  'Left Leg': [
    { id: 'noWalk',    label: "Can't Walk",      icon: '🩼' },
    { id: 'joint',     label: 'Joint Pain',      icon: '🦵' },
    { id: 'cramping',  label: 'Cramping',        icon: '🪢' },
    { id: 'wound',     label: 'Open Wound',      icon: '🩸' },
  ],
  General: [
    { id: 'fatigue',   label: 'Extreme Fatigue', icon: '💤' },
    { id: 'chills',    label: 'Chills',          icon: '🥶' },
    { id: 'dehydrate', label: 'Dehydration',     icon: '🌵' },
    { id: 'rash',      label: 'Skin Rash',       icon: '🔴' },
  ],
}

export const LANGUAGES = [
  { code: 'en', label: 'English', emoji: '🇬🇧' },
  { code: 'hi', label: 'हिंदी',    emoji: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்',   emoji: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ',   emoji: '🇮🇳' },
  { code: 'te', label: 'తెలుగు',  emoji: '🇮🇳' },
  { code: 'bn', label: 'বাংলা',   emoji: '🇮🇳' },
]

export const DURATIONS = [
  { id: 'today',   label: 'Today',       sublabel: 'Started today',        icon: '🌅' },
  { id: 'days',    label: 'Few Days',    sublabel: '2–5 days',             icon: '📅' },
  { id: 'week',    label: 'A Week+',     sublabel: 'More than a week',     icon: '🗓️' },
]

export const SEVERITIES = [
  { id: 'stable',    label: 'Stable',    sublabel: 'I can manage',     emoji: '🙂', className: 'stable' },
  { id: 'moderate',  label: 'Moderate',  sublabel: 'Getting worse',    emoji: '😟', className: 'moderate' },
  { id: 'emergency', label: 'Emergency', sublabel: 'Need help now!',   emoji: '😫', className: 'emergency' },
  { id: 'critical',  label: 'CRITICAL',  sublabel: 'Life-Threatening!', emoji: '🆘', className: 'critical' },
]

export const FIRST_AID: Record<string, string> = {
  fever:      "Keep temperature down with a damp cloth on forehead. Drink water every 15 minutes.",
  headache:   "Lie in a quiet, dark room. Avoid bright lights. Apply a cold compress.",
  breathless: "Sit upright. Loosen any tight clothing. Do not lie flat.",
  tightness:  "Sit and rest immediately. Chew aspirin if available. Call help now.",
  cramps:     "Apply heat to the abdomen. Sip warm liquids slowly.",
  noWalk:     "Do not force movement. Immobilize the leg. Elevate if possible.",
  fracture:   "Do not attempt to straighten. Immobilize and support the area.",
  dizziness:  "Sit or lie down immediately. Avoid sudden movements.",
  vomit:      "Sip small amounts of water. Do not eat. Lie on your side.",
  wound:      "Apply firm pressure with a clean cloth. Keep elevated.",
  default:    "Stay calm and rest comfortably. Help is on the way.",
}
