import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { patient_id } = body;
    if (!patient_id) return Response.json({ error: 'patient_id é obrigatório' }, { status: 400 });

    const sessions = await base44.asServiceRole.entities.Session.filter(
      { patient_id },
      'session_date'
    );

    if (!sessions || sessions.length === 0) {
      return Response.json({ evolution: 'Ainda não há sessões registradas para este paciente.', has_data: false });
    }

    const resumoSessoes = sessions.map((s, i) => {
      return `Sessão ${i + 1} (${new Date(s.session_date).toLocaleDateString('pt-BR')}):
- Queixa: ${s.chief_complaint || 'N/I'}
- Dor: ${s.pain_scale ?? 'N/I'}/10
- Mobilidade: ${s.mobility || 'N/I'}
- Resumo: ${s.ai_summary || s.transcript?.slice(0, 200) || 'N/I'}`;
    }).join('\n\n');

    const prompt = `Você é um fisioterapeuta experiente. Analise a evolução do paciente com base nas sessões registradas abaixo e produza uma análise de evolução clínica em português. Destaque: tendência da dor, evolução da mobilidade, resposta ao tratamento e recomendações para a próxima sessão. Use linguagem profissional e acessível.

${resumoSessoes}

Retorne um texto em parágrafos (máximo 3 parágrafos).`;

    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    const evolution = typeof llmRes === 'string' ? llmRes : (llmRes.text || JSON.stringify(llmRes));

    return Response.json({ evolution, has_data: true, session_count: sessions.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
