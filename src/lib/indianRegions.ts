// Indian regions used by the onboarding entrance-exam picker.
//
// `National` covers pan-India exams (JEE Main, NEET UG, etc.). The remaining
// entries are the 28 states + 8 union territories. The list is intentionally
// a plain constant (no I/O) so it can be imported by both the client picker
// and the Gemini-backed `/api/entrance-exams` route without bundling concerns.

export const NATIONAL_REGION = 'National' as const

export const INDIAN_STATES_AND_UTS: readonly string[] = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
]

/** Full region dropdown options: National first, then every state / UT. */
export const ENTRANCE_EXAM_REGIONS: readonly string[] = [
  NATIONAL_REGION,
  ...INDIAN_STATES_AND_UTS,
]

export const ENTRANCE_EXAM_STREAMS = ['Medical', 'Engineering'] as const
