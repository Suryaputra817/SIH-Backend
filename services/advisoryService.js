const translations = {
  en: {
    heavyRain: 'Heavy rain expected. Delay pesticide/fertilizer application to prevent runoff.',
    dry: 'Critical soil dryness detected. Irrigate within 24 hours.',
    heat: 'Heat stress warning: Provide light evening irrigation.',
    harvest: 'Emergency: Expedite harvest or cover harvested produce.',
    market: 'Mandi price is below MSP. Consider waiting for a better market if safe storage is available.',
    normal: 'Conditions are stable. Continue regular crop monitoring.',
  },
  hi: {
    heavyRain: 'भारी बारिश की संभावना है। बहाव से बचने के लिए कीटनाशक या उर्वरक का प्रयोग टालें।',
    dry: 'मिट्टी में नमी बहुत कम है। 24 घंटे के भीतर सिंचाई करें।',
    heat: 'गर्मी का तनाव: शाम को हल्की सिंचाई करें।',
    harvest: 'आपातकाल: कटाई जल्दी करें या कटी उपज को ढक दें।',
    market: 'मंडी भाव MSP से कम है। सुरक्षित भंडारण हो तो बेहतर भाव की प्रतीक्षा करें।',
    normal: 'स्थिति स्थिर है। फसल की नियमित निगरानी जारी रखें।',
  },
  or: {
    heavyRain: 'ପ୍ରବଳ ବର୍ଷାର ସମ୍ଭାବନା ଅଛି। ଧୋଇଯିବା ରୋକିବା ପାଇଁ କୀଟନାଶକ କିମ୍ବା ସାର ପ୍ରୟୋଗ ବିଳମ୍ବ କରନ୍ତୁ।',
    dry: 'ମାଟିରେ ଅତ୍ୟଧିକ ଶୁଷ୍କତା ଦେଖାଦେଇଛି। 24 ଘଣ୍ଟା ମଧ୍ୟରେ ଜଳସେଚନ କରନ୍ତୁ।',
    heat: 'ତାପ ଚାପ ସତର୍କତା: ସନ୍ଧ୍ୟାରେ ହାଲୁକା ଜଳସେଚନ କରନ୍ତୁ।',
    harvest: 'ଜରୁରୀ: ଶୀଘ୍ର ଅମଳ କରନ୍ତୁ କିମ୍ବା ଅମଳ ହୋଇଥିବା ଫସଲ ଘୋଡ଼ାନ୍ତୁ।',
    market: 'ମଣ୍ଡି ଦର MSP ଠାରୁ କମ୍ ଅଛି। ସୁରକ୍ଷିତ ଭଣ୍ଡାର ଥିଲେ ଭଲ ଦର ପାଇଁ ଅପେକ୍ଷା କରନ୍ତୁ।',
    normal: 'ପରିସ୍ଥିତି ସ୍ଥିର ଅଛି। ନିୟମିତ ଫସଲ ନିରୀକ୍ଷଣ ଜାରି ରଖନ୍ତୁ।',
  },
  te: {
    heavyRain: 'భారీ వర్షం వచ్చే అవకాశం ఉంది. కొట్టుకుపోకుండా పురుగుమందు లేదా ఎరువుల వాడకాన్ని వాయిదా వేయండి.',
    dry: 'నేలలో తేమ చాలా తక్కువగా ఉంది. 24 గంటల్లోపు నీటిపారుదల చేయండి.',
    heat: 'వేడి ఒత్తిడి హెచ్చరిక: సాయంత్రం తేలికపాటి నీటిపారుదల చేయండి.',
    harvest: 'అత్యవసరం: కోతను వేగవంతం చేయండి లేదా కోసిన పంటను కప్పండి.',
    market: 'మార్కెట్ ధర MSP కంటే తక్కువగా ఉంది. సురక్షిత నిల్వ ఉంటే మెరుగైన ధర కోసం వేచి ఉండండి.',
    normal: 'పరిస్థితులు స్థిరంగా ఉన్నాయి. పంటను క్రమం తప్పకుండా గమనించండి.',
  },
};

function createAdvisory({ weather, market, cropStage, language = 'or' }) {
  const locale = translations[language] ? language : 'en';
  const messages = [];
  if (weather.expectedPrecipitation24hMm > 20) messages.push({ type: 'rain', priority: 'high', text: translations[locale].heavyRain });
  if (weather.topsoilMoistureIndex < 0.15) messages.push({ type: 'drought', priority: 'critical', text: translations[locale].dry });
  if (weather.temperatureC > 38 && weather.topsoilMoistureIndex < 0.20) messages.push({ type: 'heat', priority: 'high', text: translations[locale].heat });
  if (cropStage === 'Harvesting' && weather.expectedPrecipitation24hMm > 0) messages.push({ type: 'harvest', priority: 'critical', text: translations[locale].harvest });
  if (market?.deviationPercent > 15) messages.push({ type: 'market', priority: 'medium', text: translations[locale].market });
  if (!messages.length) messages.push({ type: 'routine', priority: 'low', text: translations[locale].normal });
  return { language: locale, messages, tts: { text: messages.map((m) => m.text).join(' '), locale: { en: 'en-IN', hi: 'hi-IN', or: 'or-IN', te: 'te-IN' }[locale] } };
}

module.exports = { createAdvisory };
