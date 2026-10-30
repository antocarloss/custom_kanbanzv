/*! LCbank \u00b7 Kanban Zeev \u00b7 v2.0.0
 * Carregado por Configurar > Personaliza\u00e7\u00e3o > C\u00f3digo customizado (com SHA fixo + SRI).
 *
 * O que mostra para quem est\u00e1 logado:
 *  A) Tarefas com a pessoa (lidas da pr\u00f3pria tela Minhas tarefas)  -> Backlog / Atrasadas
 *  B) Leads de que ela \u00e9 DONA e que est\u00e3o com participantes        -> colunas da esteira
 *     (lidos do endpoint de Acompanhar solicita\u00e7\u00f5es, com a sess\u00e3o e as permiss\u00f5es dela)
 *
 * Seguran\u00e7a: s\u00f3 GET no mesmo dom\u00ednio, nenhum token, nada de dado de lead gravado no navegador,
 * nenhum conte\u00fado da tela vira HTML (s\u00f3 textContent).
 */
(function () {
  'use strict';
  if (window.__lcbKanban) return;
  window.__lcbKanban = true;
  if (window.name === 'lcbk-painel-tarefa') {
    if (/^\/(my\/tasks|report\/(my|main))\/?$/.test(location.pathname)) {
      try { window.parent.postMessage({ lcbk: 'voltar' }, location.origin); } catch (e) { /* ignora */ }
    }
    return;
  }

  // \u2550\u2550\u2550 CONFIGURA\u00c7\u00c3O \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  var CFG = {
    path: /^\/my\/tasks\/?$/,          // Minhas tarefas (visual novo)
    // Acompanhar solicita\u00e7\u00f5es / Monitorar: qualquer p\u00e1gina /my/... ou /report/... que tenha a
    // tabela de inst\u00e2ncias. A detec\u00e7\u00e3o final \u00e9 pelo HTML (td.instance-cell).
    pathInstancias: /^\/(my|report)\//,
    // Informa\u00e7\u00f5es do card, lidas do RESUMO da solicita\u00e7\u00e3o/tarefa (o que o Zeev mostra na lista).
    // Lista branca: s\u00f3 estes r\u00f3tulos s\u00e3o lidos. CPF, telefone, e-mail etc. s\u00e3o ignorados.
    // Propostas: da mais recente para a mais antiga; o card mostra a primeira que tiver valor.
    resumo: {
      // CPF do cliente no card: 'mascarado' (***.456.789-**, clique mostra completo), 'completo' ou 'oculto'
      cpf: 'mascarado',
      processo: /^(n[u\u00fa]mero (do|de) )?processo( de origem| judicial| principal)?$|^n[u\u00fa]mero do (precat[o\u00f3]rio|rpv)/i,
      face: /valor de face|\bvta\b|\bvthc\b|valor total do ativo|valor total dos honor/i,
      tipo: /^tipo (de|do) (cr[e\u00e9]dito|ativo)$|^ativo$/i,
      propostas: [
        [/corrigid/i, 'corrigida'],
        [/diretor financeiro|\bdf\b|para hoje/i, 'diretor financeiro'],
        [/segunda proposta|2[\u00aaa\u00b0o]? ?proposta|\bvsp/i, '2\u00aa proposta'],
        [/primeira proposta|1[\u00aaa\u00b0o]? ?proposta|\bvpp/i, '1\u00aa proposta'],
        [/^valor d[ao] proposta|^proposta( vigente)?$/i, 'proposta']
      ]
    },

    // Produ\u00e7\u00e3o e fechamentos (Vis\u00e3o do gestor): lidos do LOG DE TAREFAS do pr\u00f3prio Zeev
    // (export "tarefas"), com as mesmas regras da Torre de Controle.
    producao: {
      // [c\u00f3digo, vers\u00e3o, papel] \u2014 papel: pai | carteira | filho | relacionamento
      fluxos: [
        ['131', 'ed27886d-d993-4dae-9aad-e850268e0b36', 'pai'],
        ['144', '09f5cfe1-e50b-4ae6-b796-f98b67721377', 'carteira'],
        ['121', 'a70ebe16-6ed9-49d5-bd84-41417947efc1', 'filho'],
        ['128', '333a27bc-23a1-4663-80f8-52483f065654', 'filho'],
        ['153', 'd8a2b914-5316-4224-bdf5-2cf874e6f8aa', 'relacionamento']
      ],
      inicioBase: '01/01/2020',   // solicita\u00e7\u00f5es em andamento abertas desde esta data
      limiteLinhas: 1000,         // o Zeev corta o export aqui: com 1.000 linhas, divide o per\u00edodo
      atualizarMin: 15,
      triagem: 'T01',             // Pai: T01-Analisar Viabilidade finalizada = 1 triagem (data de finaliza\u00e7\u00e3o)
      aceite: 'T07',              // Filho: entrou na T07 = proposta aceita (data de recebimento da 1\u00aa T07)
      formal: 'T24',              // Filho: T24 finalizada = cess\u00e3o protocolada (data de finaliza\u00e7\u00e3o)
      sdr: ['Raphisa'],
      // Perdida "pelo jur\u00eddico" = a negocia\u00e7\u00e3o passou por uma destas tarefas (reprova\u00e7\u00e3o):
      // T11 Analisar Reprova\u00e7\u00e3o, T15 Analisar Recusa da Reprova\u00e7\u00e3o, T16 Conselho. Sen\u00e3o, "pelo cliente".
      perdaJuridico: ['T11', 'T15', 'T16'],
      // Campos do formul\u00e1rio das negocia\u00e7\u00f5es (export de solicita\u00e7\u00f5es do Zeev). Lista branca:
      // s\u00f3 estes s\u00e3o lidos; CPF, endere\u00e7o, telefone e o resto s\u00e3o descartados na leitura.
      // Propostas: da mais recente para a mais antiga (a 1\u00aa preenchida \u00e9 a vigente).
      form: {
        // Valor de face = "Valor Total do Cr\u00e9dito Principal" (vTCP). vTA/vTHC s\u00f3 se o vTCP estiver vazio.
        face: ['vTCP', 'vTA', 'vTHC'],
        propostas: [['vPAutorCorrigida', 'corrigida'], ['vPAdvCCorrigida', 'corrigida'], ['vPAdvogadoContratualCorrigida', 'corrigida'],
                    ['vPDFParaAutor', 'diretor financeiro'], ['vPDFParaAdvogado', 'diretor financeiro'], ['vPDFParaAdvogadoContratual', 'diretor financeiro'],
                    ['vSPAutor', '2\u00aa proposta'], ['vSPAdvogadoContratual', '2\u00aa proposta'],
                    ['vPPAutor', '1\u00aa proposta'], ['vPPAdvogadoContratual', '1\u00aa proposta']],
        // Advogado Sucumbencial: nomes exatos do formul\u00e1rio (Filho Adv). Cada proposta: [valor, des\u00e1gio, r\u00f3tulo].
        // Uma proposta igual ao valor de face com des\u00e1gio 0 \u00e9 preenchimento autom\u00e1tico do formul\u00e1rio: ignorada.
        sucumbencial: {
          face: ['valorDeFaceDosHononariosSucumbenciais', 'vTHS'],
          propostas: [['vPDFAdvogadoSucumbencia', 'dPDFAdvogadoSucumbencia', 'diretor financeiro'],
                      ['vSPAdvogadoSucumbencia', 'dSPAdvogadoSucumbencia', '2\u00aa proposta'],
                      ['vPPAdvogadoSucumbencia', 'dPPAdvogadoSucumbencia', '1\u00aa proposta']],
          numeroProposta: ['numeroPropostaFundoAdvSucumbencial']
        },
        tipo: ['tipoDeAtivo'],
        numeroProposta: ['numeroPropostaFundo'],
        fundo: ['fundoResponsavelAutor', 'fundoResponsavelAdvogado'],
        motivoJuridico: ['motivoDaReprovacaoProcessualDocumental', 'justificativaDiretoraJuridica', 'JustificativaCEO',
                         'justificativaDaRecusa', 'parecerSobreReprovacaoCEO', 'parecerSobreRecusaDiretoraJuridica', 'parecerDaReprovacao'],
        pendencias: ['descricaoDasPendenciasDeDocumentos', 'ListaPendenciasJuridicas', 'pendenciaDocumentalAnaliseJuridica',
                     'pendenciasProcessualAnaliseJuridica', 'observacaoDasPendencias', 'motivoDaReprovacaoProcessualDocumental'],
        motivoCliente: ['justificativaNegociacaoCanceladaCliente', 'justificativaDoCancelamentoCliente', 'justificativaDoCancelamento',
                        'justificativaDaRecusaDiretorFinanceiro', 'justificativaDoCancelamenoDiretorFinanceiro']
      },
      // Filho: tarefas que s\u00f3 existem DEPOIS do aceite (entrou na T07) e antes da cess\u00e3o (T23/T24)
      posAceite: ['T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14', 'T14.01', 'T15', 'T16',
                  'T17', 'T18', 'T19', 'T20', 'T21', 'T22']            // se a SDR for a solicitante do Filho, o dono \u00e9 quem fez a T01-Negociar Compra
    },

    // Vis\u00e3o do gestor: s\u00f3 nesta p\u00e1gina (Monitorar > Solicita\u00e7\u00f5es). Quem controla o acesso \u00e9 a
    // permiss\u00e3o de Monitorar do pr\u00f3prio Zeev; o script s\u00f3 mostra o painel onde ela j\u00e1 vale.
    pathGestor: /^\/report\/main\/?$/,
    // Lista completa: o script repete a MESMA consulta que a tela fez (mesmos filtros),
    // p\u00e1gina por p\u00e1gina. S\u00f3 GET no pr\u00f3prio Zeev, com a sess\u00e3o da pessoa.
    lista: {
      padrao: /\/api\/internal\/bpms\/[\d.]+\/instances\?/i,
      autoAte: 25000,        // carrega sozinho at\u00e9 esse total (acima, s\u00f3 com o bot\u00e3o)
      maxItens: 25000,       // teto absoluto por carga
      tamanhoPagina: 500,    // pede p\u00e1ginas grandes; se o Zeev limitar, o script se ajusta
      cardsPorColuna: 100,   // desenha at\u00e9 isso por coluna ("Mostrar mais" para o resto); contagens s\u00e3o do total
      paralelo: 4,           // p\u00e1ginas lidas ao mesmo tempo na carga completa
      cacheHoras: 12,        // validade da c\u00f3pia local criptografada da lista
      funilAcima: 3000,      // esteira comercial/jur\u00eddica numa lista maior que isso, sem filtro de fluxo: carrega s\u00f3 o funil
      atualizarMin: 2,       // rel\u00ea a lista completa sozinho a cada X min (aba vis\u00edvel), sem piscar a tela
      atualizarMinGrande: 10,// ... e a cada Y min quando a lista passa de 2.000 itens (protege o Zeev)
      grande: 2000
    },
    inst: {
      cell: 'td.instance-cell',
      numero: '.instance-cell--number',
      solicitacao: '.instance-cell--instance, .instance-cell--request, .instance-cell--title',
      status: '.instance-cell--status',
      fim: '.instance-cell--end',
      atual: '.instance-cell--current-activity',
      atividade: '.instance-summary-value.fw-bold',
      responsavel: '.instance-summary-username',
      prazo: '.instance-summary-count',
      acao: '.instance-cell--action'
    },
    pilot: false,                        // true = s\u00f3 liga com localStorage.lcbKanban = 'on'
    keys: { flag: 'lcbKanban', gestor: 'lcbGestor', view: 'lcbKanbanView', layout: 'lcbKanbanLayout',
            viewInst: 'lcbKanbanViewInst', layoutInst: 'lcbKanbanLayoutInst' },

    // Atalhos no menu lateral do Zeev. Cada atalho s\u00f3 aparece para quem ligou a chave dele
    // no pr\u00f3prio navegador (localStorage ou link ?chave=on). Isso controla s\u00f3 a TELA:
    // o destino precisa ter o pr\u00f3prio controle de acesso.
    atalhos: [
      { chave: 'lcbPainel', texto: 'Painel da opera\u00e7\u00e3o', url: 'https://dashboard.lcbank.com.br/',
        depoisDe: 'Acompanhar solicita\u00e7\u00f5es' }
    ],

    // Seletores da tela Minhas tarefas (DOM visto no v\u00eddeo, out/2026)
    sel: {
      root: '#crudList', table: '.crud-list-table', body: '#taskListBody', row: 'tr.task-card',
      task: '.task-cell--task', title: '.task-title', app: '.task-app-title',
      number: '.task-cell--number', expires: '.task-cell--expires', requester: '.task-cell--requester'
    },

    // Onde o Zeev mostra o e-mail do usu\u00e1rio logado (descobrir com o snippet do guia)
    eu: { seletor: '', atributo: 'textContent' },

    // Vis\u00e3o da equipe (gest\u00e3o). Duas travas, as duas precisam passar:
    //  1) os dados que o Zeev devolve para a pessoa incluem leads de outros donos (permiss\u00e3o no Zeev);
    //  2) o SHA-256 do e-mail dela est\u00e1 nesta lista. Gerar com:  printf '%s' 'email@dominio' | sha256sum
    // Lista vazia = ningu\u00e9m v\u00ea. Isto controla s\u00f3 a TELA; quem controla o DADO \u00e9 a permiss\u00e3o do Zeev.
    equipe: {
      liberados: [],
      minimoDonos: 2
    },

    // Fonte B: lista de Acompanhar solicita\u00e7\u00f5es
    acompanhamento: {
      url: '',              // endpoint GET do mesmo dom\u00ednio, capturado na aba Network (sem token)
      intervaloMin: 3,      // recarrega s\u00f3 com a aba vis\u00edvel
      fechadasDias: 30,     // quanto tempo um lead finalizado fica em Fechadas
      paradoDias: 3,        // destaca lead parado com participante h\u00e1 mais tempo que isso
      limite: 3000,         // prote\u00e7\u00e3o contra resposta gigante
      // Converte a resposta do Zeev no formato do Kanban. AJUSTAR depois de ver a resposta real.
      // N\u00c3O mapear CPF, telefone ou qualquer dado que o card n\u00e3o precise mostrar.
      mapear: function (json) {
        var lista = Array.isArray(json) ? json : (json && (json.items || json.data || json.result)) || [];
        return lista.map(function (r) {
          return {
            numero: r.numero,                   // n\u00ba da solicita\u00e7\u00e3o
            processo: r.processo,               // nome do fluxo
            tipo: r.tipo,                       // 'pai' | 'filho' | 'relacionamento' (opcional: deduz pelo nome)
            titulo: r.titulo,                   // nome do lead / identifica\u00e7\u00e3o curta
            atividade: r.atividade,             // atividade atual
            responsavel: r.responsavel,         // nome de quem est\u00e1 com a atividade atual
            responsavelEmail: r.responsavelEmail,
            donoTriagem: r.donoTriagem,         // e-mail (campo do Pai, repassado ao Filho)
            donoNegociacao: r.donoNegociacao,   // e-mail (campo do Filho)
            donoTriagemNome: r.donoTriagemNome, // nome para exibir (opcional)
            donoNegociacaoNome: r.donoNegociacaoNome,
            finalizado: r.finalizado,           // true/false
            resultado: r.resultado,             // ex.: 'Fechado', 'Desqualificado', 'Perdido'
            desde: r.desde,                     // quando a atividade atual come\u00e7ou
            fimEm: r.fimEm,                     // quando o processo terminou
            url: r.url                          // link da solicita\u00e7\u00e3o no Zeev (mesmo dom\u00ednio)
          };
        });
      }
    },

    // Fase do processo, mostrada em todo card. Reconhecida pelo nome do processo.
    // [id, r\u00f3tulo, regra]. A 1\u00aa que casar vence; a \u00faltima \u00e9 o padr\u00e3o (Pai).
    tipos: [
      ['relacionamento', 'Em negocia\u00e7\u00e3o relacionamento', /relacionamento/i],
      ['filho', 'Em negocia\u00e7\u00e3o', /negocia|filho/i],
      ['pai', 'Triagem', /./]
    ],
    // \u2500\u2500 Mapa das atividades, extra\u00eddo dos fluxos BPMN (raia = \u00e1rea) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // C\u00f3digo da atividade -> [\u00e1rea, etapa]. O c\u00f3digo \u00e9 lido do in\u00edcio do nome ("T08-...").
    // Os dois Filhos (Autor e Adv) usam os mesmos c\u00f3digos. Pai e Relacionamento t\u00eam mapa pr\u00f3prio,
    // porque T01..T07 significam outra coisa neles.
    atividades: {
      filho: {
        'T00': ['comercial', 'negociacao'],     // SDR
        'T01': ['comercial', 'negociacao'],     // Negociar Compra
        'T01.01': ['comercial', 'negociacao'],  // Aguarda pr\u00f3ximo contato com o cliente
        'T26': ['comercial', 'negociacao'],     // Nova Negocia\u00e7\u00e3o
        'T02': ['comercial', 'proposta'],       // Parecer do Diretor Comercial
        'T03': ['comercial', 'proposta'],       // Gerar Segunda Proposta
        'T04': ['comercial', 'proposta'],       // Parecer do Diretor Comercial
        'T05': ['financeiro', 'proposta'],      // Gerar Proposta Diretor Financeiro
        'T06': ['comercial', 'proposta'],       // Apresentar Proposta Autor/Advogado
        'T06.01': ['comercial', 'proposta'],    // Parecer do Diretor Comercial
        'T12': ['comercial', 'proposta'],       // Gerar Nova Proposta Corrigida
        'T13': ['comercial', 'proposta'],       // Nova Proposta Diretor Financeiro
        'T14': ['comercial', 'proposta'],       // Apresentar Proposta Diretor Financeiro
        'T10': ['comercial', 'pendencias'],     // Corrigir Pend\u00eancias
        'T11': ['comercial', 'pendencias'],     // Analisar Reprova\u00e7\u00e3o
        'T14.01': ['comercial', 'pendencias'],  // Corrigir Documenta\u00e7\u00e3o
        'T18': ['comercial', 'assinatura'],     // Gerenciar Assinatura do Contrato
        'T20': ['comercial', 'video'],          // Gerenciar grava\u00e7\u00e3o do v\u00eddeo de aceite
        'T07': ['juridico', 'documentacao'],    // Anexar Documenta\u00e7\u00e3o
        'T08': ['juridico', 'analise'],         // Realizar An\u00e1lise Jur\u00eddica
        'T09': ['juridico', 'analise'],         // An\u00e1lise Jur\u00eddica das Pend\u00eancias
        'T22': ['juridico', 'analise'],         // Elaborar o Parecer Jur\u00eddico
        'T15': ['juridico', 'reprovacao'],      // Analisar Recusa da Reprova\u00e7\u00e3o
        'T16': ['conselho', 'reprovacao'],      // Analisar recusa da reprova\u00e7\u00e3o (Conselho)
        'T17': ['juridico', 'contrato'],        // Elaborar Contrato
        'T19': ['juridico', 'contrato'],        // Validar assinatura
        'T21': ['juridico', 'video'],           // Validar v\u00eddeo de aceite
        'T23': ['juridico', 'cessao'],          // Solicitar Aprova\u00e7\u00e3o para o Fundo
        'T24': ['juridico', 'cessao'],          // Protocolar Cess\u00e3o de Cr\u00e9dito
        'T25': ['juridico', 'pos'],             // Acompanhar Liquida\u00e7\u00e3o
        'T27': ['juridico', 'pos'],             // Cadastrar Processo no Astrea
        'SP01.01': ['juridico', 'pos'],         // Iniciar Acompanhamento do Ativo Judicial
        'SP02.01': ['juridico', 'pos']
      },
      pai: {
        'T01': ['triagem', 'triagem'],          // Analisar Viabilidade do Processo
        'T07': ['triagem', 'acompanhar'],       // Acompanhar Lead
        'T02': ['comercial', 'ppp'],            // Analisar Processo e Negociar Compra (vendedores)
        'T06': ['comercial', 'ppp'],
        'T03': ['triagem', 'ppf'],              // Cadastrar Cliente no Astrea
        'T04': ['triagem', 'ppf'],              // Aguardando Pr\u00f3xima An\u00e1lise
        'T05': ['triagem', 'ppf']               // Analisar e Classificar Processo PPF
      },
      relacionamento: {
        'T01': ['triagem', 'triagem'],          // Analisar Relacionamento RD
        'T02': ['comercial', 'ppp'],            // vendedores
        'T06': ['comercial', 'ppp'],
        'T03': ['triagem', 'ppf'],
        'T04': ['triagem', 'ppf'],
        'T05': ['triagem', 'ppf']
      }
    },
    nomesEtapa: {
      negociacao: 'Negocia\u00e7\u00e3o', proposta: 'Proposta & Aprova\u00e7\u00e3o', pendencias: 'Pend\u00eancias',
      assinatura: 'Assinatura (comercial)', video: 'V\u00eddeo de aceite', documentacao: 'Documenta\u00e7\u00e3o',
      analise: 'An\u00e1lise jur\u00eddica', reprovacao: 'Reprova\u00e7\u00e3o', contrato: 'Contrato & Assinatura',
      cessao: 'Cess\u00e3o & Protocolo', pos: 'P\u00f3s-cess\u00e3o', triagem: 'Triagem', acompanhar: 'Acompanhar lead',
      ppf: 'PPF (proposta futura)', ppp: 'PPP (negociar compra)', outros: 'Outra etapa'
    },
    // Filas de grupo: o Zeev s\u00f3 informa o 1\u00ba nome e "+N". Para as filas conhecidas,
    // o Kanban mostra o nome da fila e quem faz parte dela. [fluxo, c\u00f3digo da atividade, nome, membros]
    filas: [
      ['pai', 'T01', 'Triagem', 'Ingrid, Wagner, R\u00e9gis, Gabriel']
    ],
    nomesArea: { comercial: 'Comercial', financeiro: 'Financeiro', juridico: 'Jur\u00eddico', conselho: 'Conselho', triagem: 'Triagem' },
    // Esteiras por time. Coluna = [id, nome, \u00e1reas, etapas] ('*' = qualquer).
    esteiras: {
      comercial: {
        nome: 'Esteira comercial',
        cols: [
          ['ppp', 'PPP (negociar compra)', ['comercial'], ['ppp']],
          ['negociacao', 'Negocia\u00e7\u00e3o', ['comercial'], ['negociacao']],
          ['proposta', 'Proposta & Aprova\u00e7\u00e3o', ['comercial', 'financeiro'], ['proposta']],
          ['pendencias', 'Pend\u00eancias', ['comercial'], ['pendencias']],
          ['assinatura', 'Assinatura & V\u00eddeo', ['comercial'], ['assinatura', 'video']],
          ['juridico', 'Com o Jur\u00eddico', ['juridico', 'conselho'], ['*']]
        ]
      },
      juridico: {
        nome: 'Esteira jur\u00eddica',
        cols: [
          ['documentacao', 'Documenta\u00e7\u00e3o', ['juridico'], ['documentacao']],
          ['analise', 'An\u00e1lise jur\u00eddica', ['juridico'], ['analise']],
          ['reprovacao', 'Reprova\u00e7\u00f5es', ['juridico', 'conselho'], ['reprovacao']],
          ['contrato', 'Contrato & Assinatura', ['juridico'], ['contrato']],
          ['video', 'V\u00eddeo de aceite', ['juridico'], ['video']],
          ['cessao', 'Cess\u00e3o & Protocolo', ['juridico'], ['cessao']],
          ['pos', 'P\u00f3s-cess\u00e3o', ['juridico'], ['pos']]
        ]
      },
      triagem: {
        nome: 'Esteira de triagem',
        cols: [
          ['triagem', 'Triagem', ['triagem'], ['triagem']],
          ['acompanhar', 'Acompanhar lead', ['triagem'], ['acompanhar']],
          ['ppf', 'PPF (proposta futura)', ['triagem'], ['ppf']],
          ['ppp', 'PPP (negociar compra)', ['triagem', 'comercial'], ['ppp']],
          ['negociacao', 'Em negocia\u00e7\u00e3o', ['comercial', 'financeiro', 'juridico', 'conselho'], ['*']]
        ]
      }
    },
  };

  // \u2550\u2550\u2550 GUARDAS \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) { return null; }
  }
  // \u2500\u2500 Ativa\u00e7\u00e3o por link: ?lcbKanban=on|off e ?lcbPainel=on|off (s\u00f3 esses valores) \u2500\u2500
  (function () {
    try {
      var qs = new URLSearchParams(location.search), mudou = false;
      [CFG.keys.flag, CFG.keys.gestor].concat(CFG.atalhos.map(function (a) { return a.chave; })).forEach(function (k) {
        var v = qs.get(k);
        if (v === 'on' || v === 'off') { ls(k, v); qs.delete(k); mudou = true; }
      });
      if (mudou && window.history && history.replaceState) {
        var q = qs.toString();
        history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash);
      }
    } catch (e) { /* navegador sem URLSearchParams: ignora */ }
  })();

  // \u2500\u2500 Atalhos no menu lateral (rodam em todas as p\u00e1ginas, independentes do Kanban) \u2500\u2500
  (function () {
    var ativos = CFG.atalhos.filter(function (a) {
      return ls(a.chave) === 'on' && /^https:\/\//.test(a.url);
    });
    if (!ativos.length) return;
    function norm(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
    function inserir() {
      ativos.forEach(function (a) {
        if (document.querySelector('[data-lcbk-atalho="' + a.chave + '"]')) return;
        var ref = Array.prototype.find.call(document.querySelectorAll('a'), function (x) {
          return norm(x.textContent) === a.depoisDe;
        });
        if (!ref) return;
        var item = (ref.closest('li') && ref.closest('li').contains(ref)) ? ref.closest('li') : ref;
        var clone = item.cloneNode(true);
        clone.setAttribute('data-lcbk-atalho', a.chave);
        clone.removeAttribute('id');
        Array.prototype.forEach.call(clone.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); });
        [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('*'))).forEach(function (x) {
          x.classList.remove('active', 'is-active', 'selected', 'current');
          x.removeAttribute('aria-current');
          Array.prototype.slice.call(x.attributes).forEach(function (at) {
            if (/^data-/.test(at.name) && at.name !== 'data-lcbk-atalho') x.removeAttribute(at.name);
          });
        });
        var link = clone.tagName === 'A' ? clone : clone.querySelector('a');
        if (!link) return;
        link.href = a.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        // troca s\u00f3 o texto do item, mantendo o \u00edcone e o estilo do Zeev
        var w = document.createTreeWalker(link, NodeFilter.SHOW_TEXT), n, trocou = false;
        while ((n = w.nextNode())) {
          if (norm(n.nodeValue)) {
            if (!trocou) { n.nodeValue = a.texto; trocou = true; } else { n.nodeValue = ''; }
          }
        }
        link.setAttribute('title', a.texto + ' (abre em nova aba)');
        link.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          window.open(a.url, '_blank', 'noopener,noreferrer');
        }, true);
        item.parentNode.insertBefore(clone, item.nextSibling);
      });
    }
    var t, tentativas = 0;
    function agendar() { clearTimeout(t); t = setTimeout(inserir, 300); }
    var timer = setInterval(function () {
      inserir();
      if (++tentativas > 20) clearInterval(timer);
    }, 500);
    try { new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  })();

  // vers\u00e3o do script: aparece na barra (ajuda no suporte) e zera escolhas salvas por vers\u00f5es antigas
  var VERSAO = '2026-10-26';
  if (ls('lcbKanbanVersao') !== VERSAO) {
    if (ls('lcbKanbanVersao') !== '2026-10-21') { try { localStorage.removeItem('lcbKanbanLayout'); } catch (e) {} }
    ls('lcbKanbanVersao', VERSAO);
  }

  var flag = ls(CFG.keys.flag);
  if (flag === 'off' || (CFG.pilot && flag !== 'on')) return;
  var MODO = CFG.path.test(location.pathname) ? 'tarefas' :
    CFG.pathInstancias.test(location.pathname) ? 'instancias' : '';
  if (!MODO) return;

  // \u2550\u2550\u2550 UTILIT\u00c1RIOS \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  var DIA = 86400000;
function fmtN(n) { return Number(n).toLocaleString('pt-BR'); }
  function clean(s) { return (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim(); }
  function lower(s) { return clean(s).toLowerCase(); }
  function txt(el) { return el ? clean(el.textContent) : ''; }
  function digits(s) { var m = clean(s).match(/\d+/); return m ? m[0] : ''; }
  function $$(q, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(q)); }
  function firstLine(el) {
    if (!el) return '';
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { var t = clean(n.nodeValue); if (t) return t; }
    return '';
  }
  // Linhas de uma c\u00e9lula pela estrutura do HTML (blocos/linhas de resumo), n\u00e3o pelo texto
  // renderizado: com a tabela escondida, innerText junta tudo numa linha s\u00f3.
  function linhasDe(el) {
    if (!el) return [];
    var rows = el.querySelectorAll('[class*="summary-row"]');
    var out = [];
    if (rows.length) {
      out.push(firstLine(el));
      Array.prototype.forEach.call(rows, function (r) { out.push(clean(r.textContent)); });
    } else {
      Array.prototype.forEach.call(el.children.length ? el.children : [el], function (c) {
        out.push(clean(c.textContent));
      });
    }
    return out.filter(Boolean);
  }
  // Segunda prote\u00e7\u00e3o: nada com cara de CPF/CNPJ chega ao card.
  // R\u00f3tulos que podem vir colados no texto do resumo do Zeev. Tudo a partir do primeiro
  // deles \u00e9 descartado: o card s\u00f3 mostra o nome.
  var ROTULOS = /(cpf|cnpj|rg|telefone|celular|whats\w*|e-?mail|p[a\u00e1]gina de origem|processo|n[u\u00fa]mero do processo|ativo|viabilidade|desqualifica\w*|valor\w*|etapa\w*|oab|endere[c\u00e7]o)\s*(do cliente\s*)?:/i;
  function cortarRotulos(t) {
    var m = String(t || '').search(ROTULOS);
    return m === -1 ? String(t || '') : String(t).slice(0, m);
  }
  // Segunda prote\u00e7\u00e3o: nada com cara de CPF, CNPJ, telefone ou e-mail chega ao card,
  // mesmo colado em outras palavras.
  function semDoc(t) {
    return clean(String(t || '')
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '')
      .replace(/(^|\D)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g, '$1')
      .replace(/(^|\D)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, '$1')
      .replace(/\(?\b\d{2}\)?\s*9?\d{4}[-\s]?\d{4}(?!\d)/g, '')
      .replace(/(cpf|cnpj|telefone|celular)\s*:?\s*$/i, ''));
  }
  function sameOrigin(href) {
    try {
      var u = new URL(href, location.origin);
      return u.origin === location.origin ? u.href : null;
    } catch (e) { return null; }
  }
  function toDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    var s = String(v);
    var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\D+(\d{1,2}):(\d{2}))?/);
    var d = m ? new Date(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 0, m[4] ? +m[5] : 0) : new Date(s);
    return isNaN(d) ? null : d;
  }
  function dias(d) { return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / DIA)) : null; }
  function fmtData(d, hora) {
    if (!d) return '';
    var s = d.toLocaleDateString('pt-BR');
    return hora ? s + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : s;
  }

  var NOME_ETAPA = CFG.nomesEtapa;
  function codigoDe(atividade) {
    var m = clean(atividade).match(/^(SP|TP|TI|T)\s*0*(\d+)(?:\.0*(\d+))?/i);
    if (!m) return '';
    return m[1].toUpperCase() + ('0' + m[2]).slice(-2) + (m[3] ? '.' + ('0' + m[3]).slice(-2) : '');
  }
  // Classifica uma atividade pelo c\u00f3digo + fluxo. Sem c\u00f3digo conhecido: \u00e1rea '' e etapa 'outros'.
  function classificar(tipo, atividade) {
    var mapa = CFG.atividades[tipo] || CFG.atividades.filho;
    var r = mapa[codigoDe(atividade)];
    return r ? { area: r[0], etapa: r[1] } : { area: '', etapa: 'outros' };
  }
  function colunasEsteira(id) {
    return CFG.esteiras[id].cols.map(function (c) {
      return { id: c[0], name: c[1], areas: c[2], etapas: c[3], precisaB: true,
               unica: c[3].length === 1 && c[3][0] !== '*' };
    });
  }
  function colunaDe(id, it) {
    var cols = CFG.esteiras[id].cols;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if ((c[2].indexOf('*') !== -1 || c[2].indexOf(it.area) !== -1) &&
          (c[3].indexOf('*') !== -1 || c[3].indexOf(it.stage) !== -1)) return c[0];
    }
    return 'outros';
  }
  // Time prov\u00e1vel da pessoa: \u00e1rea da maioria das tarefas dela em Minhas tarefas.
  var AREA_PARA_ESTEIRA = { comercial: 'comercial', financeiro: 'comercial', juridico: 'juridico',
                            conselho: 'juridico', triagem: 'triagem' };
  function detectarArea(tarefas) {
    var n = {};
    tarefas.forEach(function (t) { if (t.area) n[t.area] = (n[t.area] || 0) + 1; });
    var melhor = '', max = 0;
    Object.keys(n).forEach(function (k) { if (n[k] > max) { max = n[k]; melhor = k; } });
    if (melhor) ls('lcbKanbanArea', AREA_PARA_ESTEIRA[melhor] || '');
    return AREA_PARA_ESTEIRA[melhor] || ls('lcbKanbanArea') || '';
  }

  var NOME_TIPO = {};
  CFG.tipos.forEach(function (t) { NOME_TIPO[t[0]] = t[1]; });
  function tipoDe(processo) {
    for (var i = 0; i < CFG.tipos.length; i++) {
      if (CFG.tipos[i][2].test(processo || '')) return CFG.tipos[i][0];
    }
    return 'pai';
  }

  function quemSouEu() {
    if (!CFG.eu.seletor) return '';
    var el = document.querySelector(CFG.eu.seletor);
    if (!el) return '';
    var v = CFG.eu.atributo === 'textContent' ? el.textContent : el.getAttribute(CFG.eu.atributo);
    var m = clean(v).match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    return m ? m[0].toLowerCase() : '';
  }

  // \u2550\u2550\u2550 FONTE A: tarefas com a pessoa (DOM de Minhas tarefas) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  function parseDue(cell) {
    if (!cell) return null;
    var t = lower(cell.textContent);
    var m = t.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\D{1,4}(\d{1,2}):(\d{2}))?/);
    var d;
    if (m) {
      if (+m[3] >= 9999) return { none: true };
      d = new Date(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 23, m[4] ? +m[5] : 59);
    } else {
      var rel = /ontem/.test(t) ? -1 : /hoje/.test(t) ? 0 : /amanh/.test(t) ? 1 : null;
      if (rel === null) return null;
      var h = t.match(/(\d{1,2}):(\d{2})/), n = new Date();
      d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + rel, h ? +h[1] : 23, h ? +h[2] : 59);
    }
    return isNaN(d) ? null : { date: d };
  }

  function lerTarefas() {
    var s = CFG.sel;
    return $$(s.body + ' ' + s.row).map(function (tr) {
      var q = function (x) { return tr.querySelector(x); };
      var taskCell = q(s.task), expCell = q(s.expires);
      var due = parseDue(expCell), now = new Date();
      var late = !!(due && due.date && due.date < now) || !!(expCell && expCell.querySelector('.text-danger'));
      var numero = txt(q(s.number)) || ('#' + (tr.getAttribute('data-key') || ''));
      var titulo = txt(q(s.title)) || firstLine(taskCell) || 'Tarefa sem t\u00edtulo';
      var processo = txt(q(s.app));
      var tipo = tipoDe(processo), cl = classificar(tipo, titulo);
      return {
        kind: 'tarefa', tr: tr, taskCell: taskCell,
        link: q('a.task-open-link[href]') || q('a.task-open-button[href]') || (taskCell && taskCell.querySelector('a[href]')),
        info: infoResumo(q('.task-cell--summary') || q('.task-summary')),
        num: digits(numero), numero: numero, titulo: semDoc(titulo), processo: semDoc(processo),
        atividade: semDoc(titulo), quem: firstLine(q(s.requester)),
        due: due, late: late,
        today: !!(due && due.date && !late && due.date.toDateString() === now.toDateString()),
        stage: cl.etapa, area: cl.area,
        tipo: tipo
      };
    });
  }

  // \u2550\u2550\u2550 FONTE B: leads da pessoa (Acompanhar solicita\u00e7\u00f5es) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  var B = { status: CFG.acompanhamento.url ? 'carregando' : 'off', rows: [], erro: '', em: null, ocupado: false };
  var eu = '';

  function normalizar(r) {
    if (!r) return null;
    var num = digits(r.numero);
    if (!num) return null;
    var processo = clean(r.processo);
    return {
      num: num, numero: '#' + num, processo: processo,
      tipo: NOME_TIPO[r.tipo] ? r.tipo : tipoDe(processo),
      titulo: clean(r.titulo), atividade: clean(r.atividade),
      responsavel: clean(r.responsavel), responsavelEmail: lower(r.responsavelEmail),
      donoTriagem: lower(r.donoTriagem), donoNegociacao: lower(r.donoNegociacao),
      donoTriagemNome: clean(r.donoTriagemNome), donoNegociacaoNome: clean(r.donoNegociacaoNome),
      finalizado: r.finalizado === true || r.finalizado === 'true' || r.finalizado === 1,
      resultado: clean(r.resultado), desde: toDate(r.desde), fimEm: toDate(r.fimEm),
      href: r.url ? sameOrigin(r.url) : null
    };
  }

  function buscar() {
    var url = CFG.acompanhamento.url ? sameOrigin(CFG.acompanhamento.url) : null;
    if (!url) { B.status = 'off'; render(); return; }
    eu = quemSouEu();
    if (!eu) { B.status = 'semUsuario'; render(); return; }
    if (B.ocupado) return;
    B.ocupado = true;
    var ctrl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    fetch(url, {
      method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (!/json/i.test(r.headers.get('content-type') || '')) throw new Error('a resposta n\u00e3o veio em JSON (sess\u00e3o expirada?)');
      return r.json();
    }).then(function (json) {
      var rows = (CFG.acompanhamento.mapear(json) || []).slice(0, CFG.acompanhamento.limite);
      B.rows = rows.map(normalizar).filter(Boolean);
      B.status = 'ok'; B.erro = ''; B.em = new Date();
      return avaliarEquipe();
    }).catch(function (e) {
      B.status = 'erro';
      B.erro = e && e.name === 'AbortError' ? 'tempo esgotado' : (e && e.message) || 'erro desconhecido';
    }).then(function () {
      clearTimeout(to);
      B.ocupado = false;
      render();
    });
  }

  // \u2500\u2500\u2500 Vis\u00e3o da equipe \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  var podeEquipe = false;
  function donoDe(r) { return r.tipo === 'pai' ? r.donoTriagem : r.donoNegociacao; }
  function donoNomeDe(r) {
    var nome = r.tipo === 'pai' ? r.donoTriagemNome : r.donoNegociacaoNome;
    var d = donoDe(r);
    return nome || (d ? d.split('@')[0] : 'Sem dono');
  }
  function sha256(s) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) {
        return ('0' + x.toString(16)).slice(-2);
      }).join('');
    });
  }
  function avaliarEquipe() {
    var outros = {};
    B.rows.forEach(function (r) { var d = donoDe(r); if (d && d !== eu) outros[d] = 1; });
    var lista = (CFG.equipe.liberados || []).map(lower);
    if (Object.keys(outros).length < CFG.equipe.minimoDonos || !lista.length ||
        !window.crypto || !crypto.subtle || !eu) {
      podeEquipe = false;
      return Promise.resolve();
    }
    return sha256(eu).then(function (h) { podeEquipe = lista.indexOf(h) !== -1; })
      .catch(function () { podeEquipe = false; });
  }
  function lerEquipe() {
    if (B.status !== 'ok' || !podeEquipe) return [];
    var corte = Date.now() - CFG.acompanhamento.fechadasDias * DIA;
    return B.rows.filter(function (r) {
      return !r.finalizado || (r.fimEm && r.fimEm.getTime() >= corte);
    }).map(function (r) {
      var dono = donoDe(r);
      return {
        kind: 'lead', equipe: true,
        num: r.num, numero: r.numero, titulo: r.titulo || r.atividade, processo: r.processo,
        atividade: r.atividade, quem: r.responsavel, tipo: r.tipo, finalizado: r.finalizado,
        resultado: r.resultado, desde: r.desde, fimEm: r.fimEm, href: r.href,
        stage: classificar(r.tipo, r.atividade).etapa, area: classificar(r.tipo, r.atividade).area,
        late: false, today: false,
        dono: dono || '', donoNome: donoNomeDe(r),
        comDono: !r.finalizado && !!dono && r.responsavelEmail === dono
      };
    });
  }

  function lerLeads(numsComigo) {
    if (B.status !== 'ok') return [];
    var corte = Date.now() - CFG.acompanhamento.fechadasDias * DIA;
    var out = [];
    B.rows.forEach(function (r) {
      var meuNeg = r.tipo !== 'pai' && r.donoNegociacao === eu;
      var meuTri = r.donoTriagem === eu;
      if (!meuNeg && !meuTri) return;
      if (r.finalizado && (!r.fimEm || r.fimEm.getTime() < corte)) return;
      var comigo = !r.finalizado && !!r.responsavelEmail && r.responsavelEmail === eu;
      if (comigo && numsComigo[r.num]) return;          // j\u00e1 aparece pela fonte A
      out.push({
        kind: comigo ? 'comigoExt' : 'lead', meuNeg: meuNeg, meuTri: meuTri,
        num: r.num, numero: r.numero, titulo: r.titulo || r.atividade, processo: r.processo,
        atividade: r.atividade, quem: r.responsavel, tipo: r.tipo, finalizado: r.finalizado,
        resultado: r.resultado, desde: r.desde, fimEm: r.fimEm, href: r.href,
        stage: classificar(r.tipo, r.atividade).etapa, area: classificar(r.tipo, r.atividade).area,
        late: false, today: false
      });
    });
    return out;
  }

  // \u2550\u2550\u2550 DISPOSI\u00c7\u00d5ES \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  var comVoce = function (it) { return it.kind === 'tarefa' || it.kind === 'comigoExt'; };

  // Executar tarefas: o quadro mostra S\u00d3 as tarefas da pessoa. Nas esteiras, cada tarefa vai
  // para a coluna da etapa em que est\u00e1 (mapa de atividades). Sem colunas que dependem de dados
  // que n\u00e3o existem (dono do lead), para n\u00e3o mostrar coluna vazia com aviso.
  function esteiraTarefas(id, nome) {
    return {
      nome: nome,
      cols: function () {
        return colunasEsteira(id).map(function (c) { c.precisaB = false; return c; })
          .concat([{ id: 'outros', name: 'Outras etapas', opcional: true }]);
      },
      place: function (it) { return comVoce(it) ? colunaDe(id, it) : null; }
    };
  }
  var LAYOUTS = {
    status: {
      nome: 'Por status',
      cols: function () {
        var c = [{ id: 'backlog', name: 'No prazo' }];
        if (B.status !== 'off') c.push({ id: 'andamento', name: 'Em andamento', precisaB: true, dica: 'Seus leads com participantes' },
                                       { id: 'fechadas', name: 'Fechadas', precisaB: true, ok: true });
        c.push({ id: 'atrasadas', name: 'Atrasadas', alert: true });
        return c;
      },
      place: function (it) {
        if (comVoce(it)) return it.late ? 'atrasadas' : 'backlog';
        return it.finalizado ? 'fechadas' : 'andamento';
      }
    },
    negociacao: esteiraTarefas('comercial', 'Esteira comercial'),
    juridico: esteiraTarefas('juridico', 'Esteira jur\u00eddica'),
    triagem: esteiraTarefas('triagem', 'Esteira de triagem')
  };
  var ESTEIRA_PARA_LAYOUT = { comercial: 'negociacao', juridico: 'juridico', triagem: 'triagem' };
  function layoutAtivo() {
    if (LAYOUTS[state.layout] && (!LAYOUTS[state.layout].restrito || podeEquipe)) return state.layout;
    return ESTEIRA_PARA_LAYOUT[state.area] || 'status';
  }

  function ordenar(colId, list) {
    var key;
    if (colId === 'fechadas' || colId === 'encerrados') {
      key = function (x) { return -(x.fimEm ? x.fimEm.getTime() : 0); };
    } else if (colId === 'backlog' || colId === 'atrasadas') {
      key = function (x) {
        var t = x.due && x.due.date ? x.due.date.getTime() : 8.64e15;
        return (x.late ? -1e16 : 0) + t;
      };
    } else {
      key = function (x) { return x.desde ? x.desde.getTime() : 8.64e15; };   // mais parado primeiro
    }
    return list.sort(function (a, b) { return key(a) - key(b); });
  }

  // \u2550\u2550\u2550 RENDER (createElement + textContent) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // \u2550\u2550\u2550 ABRIR A TAREFA SEM SAIR DO KANBAN \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // A tarefa abre num painel por cima do quadro (mesma origem), com "Voltar ao Kanban".
  // Ao voltar, o quadro s\u00f3 rel\u00ea os dados; n\u00e3o recarrega a p\u00e1gina.
  var gaveta = null;
  function urlAbrivel(url) {
    var u = url && !/^\s*(#|javascript:)/i.test(url) ? sameOrigin(url) : null;
    if (!u) return null;
    var x = new URL(u);
    return x.pathname + x.search === location.pathname + location.search ? null : u;
  }
  function abrirNoPainel(url, titulo) {
    var u = urlAbrivel(url);
    if (!u) return false;
    fecharPainel(false);
    var ov = el('div', 'lcbk-gaveta');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', titulo || 'Tarefa');
    var bar = el('div', 'lcbk-gaveta-bar');
    var voltar = el('button', 'lcbk-voltar', '\u2190 Voltar ao Kanban');
    voltar.type = 'button';
    voltar.addEventListener('click', function () { fecharPainel(true); });
    bar.appendChild(voltar);
    bar.appendChild(el('span', 'lcbk-gaveta-tit', titulo || ''));
    var nova = el('a', 'lcbk-btn', 'Abrir em nova aba');
    nova.href = u; nova.target = '_blank'; nova.rel = 'noopener';
    bar.appendChild(nova);
    ov.appendChild(bar);
    var fr = el('iframe', 'lcbk-gaveta-frame');
    fr.name = 'lcbk-painel-tarefa';
    fr.title = titulo || 'Tarefa';
    fr.addEventListener('load', function () {
      try { if (!fr.contentDocument || !fr.contentDocument.body) throw new Error('vazio'); }
      catch (e) { fecharPainel(false); location.assign(u); }   // Zeev n\u00e3o deixou abrir no painel: abre como antes
    });
    fr.src = u;
    ov.appendChild(fr);
    document.body.appendChild(ov);
    document.documentElement.classList.add('lcbk-travado');
    gaveta = { ov: ov, fr: fr };
    voltar.focus();
    return true;
  }
  function fecharPainel(atualizar) {
    if (!gaveta) return;
    gaveta.ov.remove();
    gaveta = null;
    document.documentElement.classList.remove('lcbk-travado');
    if (!atualizar) return;
    if (MODO === 'tarefas') { if (LT.url && !LT.carregando) { buscarContagem(); carregarTarefas(); } }
    else if (LC.url && !LC.carregando) carregarTudo();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && gaveta) fecharPainel(true); });
  window.addEventListener('message', function (e) {
    if (gaveta && e.origin === location.origin && e.source === gaveta.fr.contentWindow && e.data && e.data.lcbk === 'voltar') fecharPainel(true);
  });
  function abrirComTecla(e, url, titulo, padrao) {
    var u = urlAbrivel(url);
    if (u && e && (e.ctrlKey || e.metaKey || e.button === 1)) { window.open(u, '_blank', 'noopener'); return; }
    if (!abrirNoPainel(url, titulo)) padrao();
  }

  function abrirTarefa(t) {
    if (t.tr && document.contains(t.tr)) {
      if (t.link) t.link.click();
      else if (t.taskCell) t.taskCell.click();
      else t.tr.click();
    } else if (t.href) {
      location.assign(t.href);
    }
  }

  function valorNum(v) {
    var m = String(v || '').replace(/[^\d,.-]/g, '');
    if (!m) return 0;
    return parseFloat(m.replace(/\./g, '').replace(',', '.')) || 0;
  }
  function moedaCurta(n) {
    return n >= 1e6 ? 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi'
      : n >= 1e3 ? 'R$ ' + Math.round(n / 1e3).toLocaleString('pt-BR') + ' mil' : 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  }
  function mascararCpf(cpf) { return '***.' + cpf.slice(4, 11) + '-**'; }
  function blocoInfo(c, info, comNome, colId) {
    if (!info) return;
    if (comNome && info.nome) c.appendChild(el('div', 'lcbk-cli', info.nome));
    if (info.cpf) {
      var completo = CFG.resumo.cpf === 'completo';
      var lin = el('div', 'lcbk-proc');
      lin.appendChild(el('span', null, 'CPF '));
      var v = el(completo ? 'strong' : 'button', completo ? null : 'lcbk-cpf', completo ? info.cpf : mascararCpf(info.cpf));
      if (!completo) {
        v.type = 'button';
        v.title = 'Mostrar o CPF completo';
        v.setAttribute('aria-label', 'Mostrar o CPF completo');
        v.addEventListener('click', function (e) {
          e.stopPropagation();                               // n\u00e3o abre a tarefa
          var aberto = v.textContent === info.cpf;
          v.textContent = aberto ? mascararCpf(info.cpf) : info.cpf;
          v.title = aberto ? 'Mostrar o CPF completo' : 'Ocultar o CPF';
        });
        v.addEventListener('keydown', function (e) { e.stopPropagation(); });
      }
      lin.appendChild(v);
      c.appendChild(lin);
    }
    var linhas = [];
    if (info.procNum) {
      var pr = el('div', 'lcbk-proc');
      pr.appendChild(el('span', null, 'Processo '));
      pr.appendChild(el('strong', null, info.procNum));
      pr.title = 'Processo ' + info.procNum;
      c.appendChild(pr);
    }
    var aceita = ['fecCom', 'cessao', 'fechados', 'pos'].indexOf(colId) !== -1;

    var perdidaCol = /^perd|^rejJur/.test(colId || '');
    var rotProp = colId === 'fechados' || colId === 'pos' ? 'Valor pago' : aceita ? 'Proposta aceita' : perdidaCol ? '\u00daltima proposta' : 'Proposta vigente';
    if (info.face) linhas.push([info.faceRot ? 'Valor de face (honor\u00e1rios)' : 'Valor de face', info.face, '', 'is-face']);
    if (info.proposta) linhas.push([rotProp, info.proposta, '', 'is-valor']);
    else if (info.semProposta) linhas.push([rotProp, 'sem proposta', '', 'is-vazio']);
    var elMot = null;
    if (colId === 'pendencias' && info.pend) {
      elMot = el('div', 'lcbk-motivo is-pend', 'Pend\u00eancia: ' + info.pend.replace(/^\s*pend[e\u00ea]ncias?\s*:\s*/i, ''));
      elMot.title = info.pend;
    }
    if (perdidaCol || colId === 'rejJur') {
      var mot = colId === 'perdJur' || colId === 'rejJur' ? (info.motJur || info.motCli) : (info.motCli || info.motJur);
      mot = (mot || '').replace(/^\s*motivo\s*:\s*/i, '').replace(/[\s,;:\u2013-]+$/, '');
      elMot = el('div', 'lcbk-motivo', mot ? 'Motivo: ' + mot : 'Motivo n\u00e3o informado no formul\u00e1rio');
      if (mot) elMot.title = mot;
    }
    if (!linhas.length) { if (elMot) c.appendChild(elMot); return; }
    var g = el('dl', 'lcbk-info');
    linhas.forEach(function (l) {
      g.appendChild(el('dt', null, l[0]));
      var dd = el('dd', l[3], l[1]);
      if (l[2]) dd.appendChild(el('small', null, l[2]));
      g.appendChild(dd);
    });
    c.appendChild(g);
    if (elMot) c.appendChild(elMot);
  }
  function chipTipo(tags, info) {
    if (info && info.tipo) tags.appendChild(el('span', 'lcbk-chip is-ativo', info.tipo));
  }

  function botaoMais(resto, onClick) {
    var b = el('button', 'lcbk-btn lcbk-mais',
      'Mostrar mais ' + fmtN(Math.min(resto, CFG.lista.cardsPorColuna)) + ' (' + fmtN(resto) + ' restantes)');
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function card(it, layoutId) {
    var lead = it.kind === 'lead';
    var parado = lead && !it.finalizado && it.desde && dias(it.desde) >= CFG.acompanhamento.paradoDias;
    var cls = 'lcbk-card' + (it.late ? ' is-late' : it.today ? ' is-today' : '') +
      (lead ? ' is-lead' : '') + (parado ? ' is-stuck' : '') + (it.finalizado ? ' is-done' : '');
    var c;
    if (it.kind === 'tarefa') {
      c = el('article', cls);
      c.tabIndex = 0;
      c.setAttribute('role', 'button');
      c.addEventListener('click', function (e) {
        var url = it.href || (it.link && it.link.getAttribute('href'));
        abrirComTecla(e, url, it.numero + ' \u00b7 ' + it.titulo, function () { abrirTarefa(it); });
      });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); }
      });
    } else if (it.href) {
      c = el('a', cls);
      c.href = it.href;
    } else {
      c = el('article', cls);
    }
    c.setAttribute('aria-label', it.numero + ' ' + it.titulo);

    var top = el('div', 'lcbk-top');
    top.appendChild(el('span', 'lcbk-num', it.numero));
    var flag = it.late ? ['Atrasada', ''] : it.today ? ['Vence hoje', 'is-today'] :
      (it.equipe && parado) ? ['Parado h\u00e1 ' + dias(it.desde) + 'd', 'is-stuck'] :
      (it.equipe && it.comDono) ? ['Com o dono', 'is-you'] :
      it.kind === 'comigoExt' ? ['Com voc\u00ea', 'is-you'] :
      it.finalizado ? [it.resultado || 'Finalizado', /desqualif|perd|cancel|reprov/i.test(it.resultado) ? 'is-lost' : 'is-done'] :
      parado ? ['Parado h\u00e1 ' + dias(it.desde) + 'd', 'is-stuck'] : null;
    if (flag) top.appendChild(el('span', 'lcbk-flag ' + flag[1], flag[0]));
    c.appendChild(top);

    c.appendChild(el('div', 'lcbk-title', it.titulo));
    if (lead && it.atividade && it.atividade !== it.titulo) c.appendChild(el('div', 'lcbk-app', it.atividade));
    blocoInfo(c, it.info, it.kind === 'tarefa');
    if (it.processo) c.appendChild(el('div', 'lcbk-app', it.processo));

    var tags = el('div', 'lcbk-tags');
    tags.appendChild(el('span', 'lcbk-tipo is-' + it.tipo, NOME_TIPO[it.tipo] || NOME_TIPO.pai));
    chipTipo(tags, it.info);
    var mostrarEtapa = !it.finalizado && it.stage && it.stage !== 'outros' && !(it._col && it._col.unica) &&
      !(it.tipo !== 'filho' && it.stage === 'triagem');
    if (mostrarEtapa) tags.appendChild(el('span', 'lcbk-chip', NOME_ETAPA[it.stage] || it.stage));
    c.appendChild(tags);

    var foot = el('div', 'lcbk-foot');
    if (it.kind === 'tarefa') {
      foot.appendChild(el('span', 'lcbk-due', !it.due ? 'Prazo n\u00e3o identificado' :
        it.due.none ? 'Sem prazo' : fmtData(it.due.date, true)));
      if (it.quem) foot.appendChild(el('span', 'lcbk-who', it.quem));
    } else if (it.finalizado) {
      foot.appendChild(el('span', 'lcbk-due', 'Finalizado em ' + fmtData(it.fimEm)));
      if (it.equipe) foot.appendChild(el('span', 'lcbk-who', 'Dono: ' + it.donoNome));
    } else {
      foot.appendChild(el('span', 'lcbk-due', it.desde ? 'Desde ' + fmtData(it.desde) + ' (' + dias(it.desde) + 'd)' : ''));
      if (it.equipe) foot.appendChild(el('span', 'lcbk-who lcbk-owner', 'Dono: ' + it.donoNome));
      if (it.quem && !it.comDono) foot.appendChild(el('span', 'lcbk-who', 'Com ' + it.quem));
    }
    c.appendChild(foot);
    return c;
  }

  function avisoB() {
    var msg = {
      off: 'Acompanhamento de leads ainda n\u00e3o configurado. Aqui v\u00e3o aparecer seus leads que est\u00e3o com participantes.',
      semUsuario: 'N\u00e3o foi poss\u00edvel identificar seu usu\u00e1rio para achar os leads de que voc\u00ea \u00e9 dono.',
      carregando: 'Carregando seus leads...',
      erro: 'N\u00e3o foi poss\u00edvel buscar seus leads (' + B.erro + '). Suas tarefas continuam no Backlog. Use Atualizar para tentar de novo.'
    }[B.status];
    return el('p', 'lcbk-empty' + (B.status === 'erro' ? ' is-err' : ''), msg || '');
  }

  var state = {
    view: ls(CFG.keys.view) || 'kanban',
    layout: LAYOUTS[ls(CFG.keys.layout)] ? ls(CFG.keys.layout) : '',   // vazio = autom\u00e1tico
    area: ls('lcbKanbanArea') || '',
    busca: '',
    lim: {},
    dono: '',
    fase: ''
  };
  var ui = {};

  function combina(it, q) {
    if (!q) return true;
    var inf = it.info || {};
    var cpf = inf.cpf ? inf.cpf + ' ' + inf.cpf.replace(/\D/g, '') : '';
    return [it.numero, it.titulo, it.processo, it.atividade, it.quem, it.donoNome, inf.nome, inf.procNum, cpf].join(' ').toLowerCase().indexOf(q) !== -1;
  }

  function resumoEquipe(itens) {
    var por = {};
    itens.forEach(function (it) {
      if (it.finalizado) return;
      var k = it.dono || '';
      var r = por[k] || (por[k] = { dono: k, nome: it.donoNome, total: 0, parados: 0, comDono: 0 });
      r.total++;
      if (it.comDono) r.comDono++;
      else if (it.desde && dias(it.desde) >= CFG.acompanhamento.paradoDias) r.parados++;
    });
    var lista = Object.keys(por).map(function (k) { return por[k]; })
      .sort(function (a, b) { return b.parados - a.parados || b.total - a.total; });
    var box = el('div', 'lcbk-resumo');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Resumo por dono');
    lista.forEach(function (r) {
      var b = el('button', 'lcbk-pessoa' + (state.dono === r.dono ? ' is-on' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', state.dono === r.dono ? 'true' : 'false');
      b.appendChild(el('strong', null, r.nome));
      b.appendChild(el('span', null, r.total + (r.total === 1 ? ' ativo' : ' ativos')));
      if (r.comDono) b.appendChild(el('span', 'is-you', r.comDono + ' com o dono'));
      if (r.parados) b.appendChild(el('span', 'is-stuck', r.parados + (r.parados === 1 ? ' parado' : ' parados')));
      b.addEventListener('click', function () {
        state.dono = state.dono === r.dono ? '' : r.dono;
        render();
      });
      box.appendChild(b);
    });
    return box;
  }

  function opcoesLayout() {
    var atual = layoutAtivo();
    var chaves = Object.keys(LAYOUTS).filter(function (k) { return !LAYOUTS[k].restrito || podeEquipe; });
    if (ui.layout.options.length !== chaves.length) {
      ui.layout.replaceChildren();
      chaves.forEach(function (k) {
        var o = el('option', null, LAYOUTS[k].nome);
        o.value = k;
        ui.layout.appendChild(o);
      });
    }
    ui.layout.value = atual;
  }

  function opcoesFiltro(itens) {
    var donos = {};
    itens.forEach(function (it) { if (it.dono) donos[it.dono] = it.donoNome; });
    var sel = ui.fDono;
    sel.replaceChildren(el('option', null, 'Todos os donos'));
    sel.options[0].value = '';
    Object.keys(donos).sort(function (a, b) { return donos[a].localeCompare(donos[b]); }).forEach(function (d) {
      var o = el('option', null, donos[d]);
      o.value = d;
      sel.appendChild(o);
    });
    if (state.dono && !donos[state.dono]) state.dono = '';
    sel.value = state.dono;
    ui.fFase.value = state.fase;
  }

  function render() {
    if (!ui.board) return;
    var completoT = !!(LT.completo && LT.completo.base === LT.base);
    var tarefas = completoT ? LT.completo.itens.slice()
      : (LT.carregando && LT.parcial && LT.parcial.length ? LT.parcial.slice() : lerTarefas());
    state.area = detectarArea(tarefas);
    var numsComigo = {};
    tarefas.forEach(function (t) { if (t.num) numsComigo[t.num] = true; });
    var layoutId = layoutAtivo();
    var equipe = layoutId === 'equipe';
    var itens = equipe ? lerEquipe() : tarefas.concat(lerLeads(numsComigo));
    var L = LAYOUTS[layoutId];
    if (equipe) opcoesFiltro(itens);
    var porFase = equipe ? itens.filter(function (it) { return !state.fase || it.tipo === state.fase; }) : itens;
    var cols = L.cols();
    var buckets = {};
    cols.forEach(function (c) { buckets[c.id] = []; });
    var q = state.busca.toLowerCase();
    var ocultos = 0;
    porFase.forEach(function (it) {
      var col = L.place(it);
      if (!col || !buckets[col]) return;
      if (!combina(it, q) || (equipe && state.dono && it.dono !== state.dono)) { ocultos++; return; }
      buckets[col].push(it);
    });

    // Total de tarefas que o Zeev informa ("Pendentes (60 de 7513)"): a p\u00e1gina traz s\u00f3 uma parte.
    // Contagem oficial do Zeev (count-filtered) quando dispon\u00edvel; sen\u00e3o, o texto "Pendentes (x de N)".
    var cont = LT.cont && LT.cont.base === LT.base ? LT.cont : null;
    var totT = cont ? cont.filtered : totalZeev();
    var limitadoT = completoT && LT.completo.limitado;
    var parcialT = !!(totT && totT > tarefas.length && !(completoT && !limitadoT));
    var backlogTotal = false;
    // Na disposi\u00e7\u00e3o Por status, Backlog = no prazo e Atrasadas = fora do prazo: a contagem do Zeev d\u00e1 os dois exatos.
    var statusExato = layoutId === 'status' && cont && parcialT && !q;

    var frag = document.createDocumentFragment();
    cols.forEach(function (c) {
      var list = buckets[c.id];
      if (c.opcional && !list.length) return;
      var sec = el('section', 'lcbk-col' + (c.alert ? ' is-alert' : '') + (c.ok ? ' is-ok' : ''));
      var head = el('header', 'lcbk-head');
      var h = el('div');
      h.appendChild(el('h3', null, c.name));
      var n = list.length;
      var extN = list.filter(function (x) { return x.kind !== 'tarefa'; }).length;
      if (c.id === 'backlog' && backlogTotal && parcialT && !q) {
        n = totT + extN;
        h.appendChild(el('small', null, list.length + ' nesta p\u00e1gina'));
      } else if (statusExato && (c.id === 'backlog' || c.id === 'atrasadas')) {
        n = (c.id === 'backlog' ? cont.ontime : cont.filtered - cont.ontime) + extN;
        h.appendChild(el('small', null, 'Total do Zeev (' + list.length + ' nesta p\u00e1gina)'));
      } else if (c.dica) {
        h.appendChild(el('small', null, c.dica));
      }
      head.appendChild(h);
      head.appendChild(el('span', 'lcbk-count', fmtN(n)));
      sec.appendChild(head);
      var body = el('div', 'lcbk-list');
      if (c.precisaB && B.status !== 'ok') body.appendChild(avisoB());
      else if (!list.length) body.appendChild(el('p', 'lcbk-empty', q ? 'Nada com esse filtro' : 'Nada aqui'));
      var ordT = ordenar(c.id, list), limT = (state.lim[c.id] || CFG.lista.cardsPorColuna);
      ordT.slice(0, limT).forEach(function (it) { it._col = c; body.appendChild(card(it, layoutId)); });
      if (ordT.length > limT) body.appendChild(botaoMais(ordT.length - limT, function () {
        state.lim[c.id] = limT + CFG.lista.cardsPorColuna; render();
      }));
      sec.appendChild(body);
      frag.appendChild(sec);
    });
    ui.board.replaceChildren(frag);
    ui.resumo.replaceChildren(equipe ? resumoEquipe(porFase) : document.createTextNode(''));
    ui.resumo.style.display = equipe && state.view === 'kanban' ? '' : 'none';
    ui.filtros.style.display = equipe ? '' : 'none';
    ui.board.style.setProperty('--lcbk-cols', String(ui.board.children.length));

    var st = B.status === 'ok' ? 'Leads atualizados \u00e0s ' + B.em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) :
      B.status === 'carregando' ? 'Carregando leads...' : B.status === 'erro' ? 'Falha ao carregar leads' : '';
    if (completoT) {
      st = (limitadoT ? fmtN(tarefas.length) + ' de ' + fmtN(totT) + ' tarefas carregadas'
                      : 'Todas as ' + fmtN(tarefas.length) + ' tarefas carregadas') +
        ' \u00e0s ' + LT.completo.em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + (st ? ' | ' + st : '');
    } else if (parcialT) {
      st = tarefas.length + ' de ' + fmtN(totT) + ' tarefas nesta p\u00e1gina' + (st ? ' | ' + st : '');
    }
    var mostrarAviso = (parcialT && !backlogTotal && !statusExato) || LT.erro || limitadoT;
    ui.aviso.textContent = LT.erro ? 'Lista completa: ' + LT.erro + '. Mostrando s\u00f3 a p\u00e1gina atual.'
      : limitadoT ? 'Carregadas as primeiras ' + fmtN(tarefas.length) + ' de ' + fmtN(totT) + ' tarefas (limite de ' +
        fmtN(CFG.lista.maxItens) + ' para n\u00e3o pesar no Zeev). Filtre a lista para ter os n\u00fameros completos.'
      : mostrarAviso ? 'Mostrando ' + tarefas.length + ' de ' + fmtN(totT) +
        ' tarefas. As colunas contam s\u00f3 as desta p\u00e1gina: use "Carregar todas" ou o Filtrar do Zeev.' : '';
    ui.aviso.style.display = mostrarAviso && state.view === 'kanban' ? '' : 'none';
    var faltaT = !completoT && parcialT && LT.url;
    ui.btnTudo.style.display = (faltaT || LT.carregando) && state.view === 'kanban' ? '' : 'none';
    ui.btnTudo.textContent = LT.carregando ? LT.prog + ' (cancelar)' :
      'Carregar todas (' + fmtN(Math.min(totT || 0, CFG.lista.maxItens)) + ')';
    if (LT.carregando) ui.btnTudo.textContent = LT.prog + ' Cancelar';
    ui.btnAtual.style.display = completoT && !LT.carregando && state.view === 'kanban' ? '' : 'none';
    ui.status.textContent = st + (ocultos ? (st ? ' | ' : '') + ocultos + ' oculto(s) pelo filtro' : '') + ' | Kanban ' + VERSAO;
    document.documentElement.classList.toggle('lcbk-on', state.view === 'kanban');
    syncBar();
  }

  function seg(label, value) {
    var b = el('button', 'lcbk-seg', label);
    b.type = 'button';
    b.dataset.value = value;
    b.addEventListener('click', function () {
      state.view = value;
      ls(CFG.keys.view, value);
      render();
    });
    return b;
  }

  function syncBar() {
    $$('.lcbk-seg', ui.bar).forEach(function (b) {
      var on = state.view === b.dataset.value;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    ui.tools.style.display = state.view === 'kanban' ? '' : 'none';
    opcoesLayout();
  }

  function css() {
    if (document.getElementById('lcbk-css')) return;
    var s = el('style');
    s.id = 'lcbk-css';
    s.textContent = [
      '.lcbk-on .crud-list-table{display:none!important}',
      '.lcbk-on .lcbk-oculto{display:none!important}',
      '.lcbk-board{display:none}',
      '.lcbk-on .lcbk-board.lcbk-largo{grid-template-columns:repeat(var(--lcbk-cols,4),minmax(270px,1fr))}',
      '.lcbk-on .lcbk-board{display:grid;grid-template-columns:repeat(var(--lcbk-cols,4),minmax(210px,1fr));gap:12px;overflow-x:auto;padding:4px 0 12px}',
      '.lcbk-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 12px}',
      '.lcbk-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;flex:1}',
      '.lcbk-group{display:inline-flex;border:1px solid #d9dce3;border-radius:8px;overflow:hidden}',
      '.lcbk-seg,.lcbk-btn{border:0;background:#fff;color:#404857;font-family:inherit;font-size:13px;font-weight:500;line-height:1;padding:9px 12px;cursor:pointer}',
      '.lcbk-seg+.lcbk-seg{border-left:1px solid #d9dce3}',
      '.lcbk-seg.is-on{background:#1b2f5c;color:#fff}',
      '.lcbk-btn{border:1px solid #d9dce3;border-radius:8px}',
      '.lcbk-select,.lcbk-search{font-family:inherit;font-size:13px;color:#404857;border:1px solid #d9dce3;border-radius:8px;padding:7px 10px;background:#fff}',
      '.lcbk-search{min-width:200px}',
      '.lcbk-status{font-size:12px;color:#6b778c;margin-left:auto}',
      '.lcbk-seg:focus-visible,.lcbk-btn:focus-visible,.lcbk-select:focus-visible,.lcbk-search:focus-visible,.lcbk-card:focus-visible{outline:2px solid #3b6fd8;outline-offset:2px}',
      '.lcbk-col{background:#f4f6f9;border-radius:10px;border-top:3px solid #3b6fd8;display:flex;flex-direction:column;min-height:160px;max-height:calc(100vh - 260px)}',
      '.lcbk-col.is-alert{border-top-color:#c8372d;background:#fbf3f2}',
      '.lcbk-col.is-ok{border-top-color:#2e8b57}',
      '.lcbk-head{display:flex;justify-content:space-between;align-items:baseline;padding:12px 14px 8px;gap:8px}',
      '.lcbk-head h3{margin:0;font-size:14px;font-weight:600;color:#1b2f5c}',
      '.lcbk-head small{display:block;font-size:11.5px;color:#6b778c;margin-top:2px}',
      '.lcbk-count{font-size:13px;font-weight:600;color:#3b6fd8}',
      '.is-alert .lcbk-count{color:#c8372d}',
      '.is-ok .lcbk-count{color:#2e8b57}',
      '.lcbk-list{overflow-y:auto;padding:0 10px 10px;display:flex;flex-direction:column;gap:8px}',
      '.lcbk-card{display:block;background:#fff;border:1px solid #e3e6ec;border-radius:8px;padding:10px 12px;cursor:pointer;color:inherit;text-decoration:none}',
      'a.lcbk-card:hover,article.lcbk-card[role=button]:hover{border-color:#3b6fd8}',
      '.lcbk-card.is-lead{background:#fbfcfe}',
      '.lcbk-card.is-late{border-left:3px solid #c8372d}',
      '.lcbk-card.is-today{border-left:3px solid #d99a1e}',
      '.lcbk-card.is-stuck{border-left:3px solid #d97a1e}',
      '.lcbk-card.is-done{opacity:.85}',
      '.lcbk-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:6px}',
      '.lcbk-num{font-size:12px;color:#5e6c84}',
      '.lcbk-flag{font-size:11px;font-weight:600;color:#c8372d;white-space:nowrap}',
      '.lcbk-flag.is-today{color:#a26f0c}',
      '.lcbk-flag.is-stuck{color:#b45f0e}',
      '.lcbk-flag.is-you{color:#3b6fd8}',
      '.lcbk-flag.is-done{color:#2e7d4f}',
      '.lcbk-flag.is-lost{color:#6b778c}',
      '.lcbk-title{font-size:13.5px;font-weight:600;color:#172b4d;line-height:1.3}',
      '.lcbk-app{font-size:12px;color:#6b778c;margin-top:2px;line-height:1.3}',
      '.lcbk-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}',
      '.lcbk-chip,.lcbk-tipo{display:inline-block;font-size:11px;font-weight:600;border-radius:6px;padding:2px 7px}',
      '.lcbk-chip{color:#1b2f5c;background:#e8eefb}',
      '.lcbk-tipo{border:1px solid currentColor}',
      '.lcbk-tipo.is-pai{color:#6a3fb5}',
      '.lcbk-tipo.is-filho{color:#1d5fbf}',
      '.lcbk-tipo.is-relacionamento{color:#0f7a6c}',
      '.lcbk-foot{display:flex;flex-direction:column;gap:2px;margin-top:8px;font-size:12px;color:#5e6c84}',
      '.is-late .lcbk-due{color:#c8372d;font-weight:600}',
      '.lcbk-who{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.lcbk-empty{font-size:12.5px;color:#6b778c;margin:4px 2px;line-height:1.4}',
      '.lcbk-empty.is-err{color:#a1281f}',
      '.lcbk-filtros{display:inline-flex;gap:10px;flex-wrap:wrap}',
      '.lcbk-resumo{display:flex;gap:8px;overflow-x:auto;padding:0 0 12px}',
      '.lcbk-pessoa{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:150px;text-align:left;border:1px solid #d9dce3;border-radius:8px;background:#fff;padding:8px 12px;font-family:inherit;font-size:12px;color:#5e6c84;cursor:pointer}',
      '.lcbk-pessoa strong{font-size:13px;color:#172b4d}',
      '.lcbk-pessoa.is-fila{border-style:dashed;background:#fafbfc}',
      '.lcbk-pessoa.is-fila .lcbk-time{color:#b45f0e}',
      '.lcbk-time{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#6a3fb5}',
      '.lcbk-pessoa .is-stuck{color:#b45f0e;font-weight:600}',
      '.lcbk-pessoa .is-you{color:#3b6fd8}',
      '.lcbk-pessoa.is-on{border-color:#1b2f5c;box-shadow:inset 0 0 0 1px #1b2f5c}',
      '.lcbk-pessoa:focus-visible{outline:2px solid #3b6fd8;outline-offset:2px}',
      '.lcbk-owner{color:#1b2f5c;font-weight:600}',
      '.lcbk-atv{color:#404857;font-weight:500}',
      '.lcbk-aviso{margin:0 0 10px;padding:8px 12px;border-radius:8px;background:#fff7e6;color:#7a4a00;font-size:12.5px}',
      '.lcbk-linkbtn{border:0;background:none;padding:0;color:#3b6fd8;font:inherit;font-weight:600;text-decoration:underline;cursor:pointer}',
      '.lcbk-painel{margin:0 0 16px;background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:18px 20px}',
      '.lcbk-g-head{display:flex;align-items:flex-start;gap:16px;margin:0 0 14px}',
      '.lcbk-g-head h2{margin:0;font-size:20px;font-weight:700;color:#1b2f5c;letter-spacing:-.01em}',
      '.lcbk-g-head p{margin:2px 0 0;font-size:12.5px;color:#6b778c}',
      '.lcbk-g-head .lcbk-btn{margin-left:auto}',
      '.lcbk-funil{display:flex;gap:4px;margin:0 0 10px;overflow-x:auto}',
      '.lcbk-etapa{flex:1 1 0;min-width:130px;display:flex;flex-direction:column;align-items:flex-start;gap:2px;border:0;margin:0;font-family:inherit;text-align:left;color:#fff;background:var(--c);padding:12px 18px 12px 26px;clip-path:polygon(0 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,0 100%,14px 50%)}',
      '.lcbk-etapa.is-primeira{padding-left:16px;border-radius:8px 0 0 8px;clip-path:polygon(0 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,0 100%)}',
      'button.lcbk-etapa{cursor:pointer}',
      'button.lcbk-etapa:hover{filter:brightness(1.08)}',
      'button.lcbk-etapa:focus-visible{outline:3px solid #172b4d;outline-offset:-3px}',
      '.lcbk-etapa .n{font-size:28px;font-weight:700;line-height:1.05;font-variant-numeric:tabular-nums}',
      '.lcbk-etapa .t{font-size:12.5px;font-weight:600;opacity:.95}',
      '.lcbk-etapa .s{font-size:11.5px;opacity:.8}',
      '.lcbk-alerta{display:inline-flex;align-items:baseline;gap:4px;border:0;background:#fbeceb;color:#8f241c;font-family:inherit;font-size:13px;border-radius:999px;padding:6px 14px;margin:0 0 16px;cursor:pointer}',
      '.lcbk-alerta strong{font-weight:700}',
      '.lcbk-time-sec{margin:18px 0 0}',
      '.lcbk-time-head{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 10px;padding-left:10px;border-left:4px solid var(--c)}',
      '.lcbk-time-head h3{margin:0 6px 0 0;font-size:16px;font-weight:700;color:#172b4d}',
      '.lcbk-chip-t{font-size:12px;color:#404857;background:#f1f3f7;border-radius:999px;padding:3px 10px}',
      '.lcbk-chip-t.is-alerta{background:#fbeceb;color:#8f241c;font-weight:600}',
      '.lcbk-pc-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}',
      '.lcbk-pc{display:flex;flex-direction:column;gap:6px;text-align:left;font-family:inherit;background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:14px 14px 12px;cursor:pointer;position:relative;overflow:hidden}',
      '.lcbk-pc::before{content:"";position:absolute;inset:0 0 auto 0;height:4px;background:var(--c)}',
      '.lcbk-pc:hover{border-color:var(--c)}',
      '.lcbk-pc.is-on{border-color:var(--c);box-shadow:inset 0 0 0 1px var(--c)}',
      '.lcbk-pc:focus-visible{outline:2px solid #3b6fd8;outline-offset:2px}',
      '.lcbk-pc-topo{display:flex;align-items:center;gap:10px}',
      '.lcbk-av{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--c);color:#fff;font-size:12.5px;font-weight:700}',
      '.lcbk-pc-nome{font-size:13.5px;font-weight:600;color:#172b4d;line-height:1.25;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
      '.lcbk-pc-big{display:flex;align-items:baseline;gap:8px;margin-top:4px}',
      '.lcbk-pc-big .n{font-size:34px;font-weight:800;line-height:1;color:var(--c);font-variant-numeric:tabular-nums}',
      '.lcbk-pc-big .l{font-size:12px;color:#5e6c84;line-height:1.2}',
      '.lcbk-pc-sub{font-size:12px;color:#404857;font-weight:600}',
      '.lcbk-pc-lin{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}',
      '.lcbk-pc-x{font-size:11.5px;color:#404857;background:#f4f6f9;border-radius:6px;padding:3px 7px}',
      '.lcbk-pc-x strong{font-weight:700;color:#172b4d}',
      '.lcbk-pc-x.is-alerta{background:#fbeceb;color:#8f241c}',
      '.lcbk-pc-x.is-alerta strong{color:#8f241c}',
      '.lcbk-pc-alerta{font-size:11.5px;color:#a1281f;margin-top:2px}',
      '.lcbk-viz-larga{margin-top:20px;border:1px solid #e3e6ec;border-radius:12px;padding:14px 16px}',
      '.lcbk-viz-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 32px}',
      '.lcbk-viz-head h3{margin:0;font-size:14px;font-weight:700;color:#172b4d}',
      '.lcbk-viz-head p{margin:2px 0 10px;font-size:12px;color:#6b778c}',
      '.lcbk-viz-vazio,.lcbk-viz-mais{font-size:12.5px;color:#6b778c;margin:6px 0}',
      '.lcbk-bars{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}',
      '.lcbk-bar{display:grid;grid-template-columns:minmax(110px,170px) 1fr auto;align-items:center;column-gap:10px;border-radius:6px;padding:2px 4px}',
      '.lcbk-bar[role=button]{cursor:pointer}',
      '.lcbk-bar[role=button]:hover,.lcbk-bar.is-on{background:#f1f4fa}',
      '.lcbk-bar[role=button]:focus-visible{outline:2px solid #3b6fd8;outline-offset:1px}',
      '.lcbk-bar-nome{font-size:12.5px;color:#172b4d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lcbk-bar-trilho{display:flex;height:12px;background:#f0f2f6;border-radius:3px;overflow:hidden}',
      '.lcbk-bar-f{display:block;height:100%}',
      '.lcbk-bar-f.is-claro{opacity:.35}',
      '.lcbk-bar-num{font-size:13px;font-weight:700;color:#172b4d;font-variant-numeric:tabular-nums;min-width:34px;text-align:right}',
      '.lcbk-bar-nota{grid-column:2 / 4;font-size:11px;color:#6b778c;margin-top:-2px}',
      '.lcbk-dias{display:flex;align-items:flex-end;gap:3px;height:140px;padding-top:16px}',
      '.lcbk-dia{flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:8px;position:relative}',
      '.lcbk-dia-bar{width:100%;max-width:22px;border-radius:3px 3px 0 0;opacity:.45}',
      '.lcbk-dia.is-hoje .lcbk-dia-bar{opacity:1}',
      '.lcbk-dia-v{font-size:11px;font-weight:700;color:#172b4d;margin-bottom:2px;font-variant-numeric:tabular-nums}',
      '.lcbk-dia-d{font-size:10px;color:#8993a4;margin-top:3px}',
      '.lcbk-dia.is-hoje .lcbk-dia-d{color:#172b4d;font-weight:700}',
      '@media (max-width:1100px){.lcbk-viz-grid{grid-template-columns:1fr}}',
      '.lcbk-painel-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 10px}',
      '.lcbk-painel-head h2{margin:0;font-size:16px;font-weight:700;color:#1b2f5c}',
      '.lcbk-painel-head span{font-size:12px;color:#6b778c}',
      '.lcbk-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:10px;margin:0 0 12px}',
      '.lcbk-kpi{display:block;text-align:left;font-family:inherit;background:#fff;border:1px solid #e3e6ec;border-top:3px solid #3b6fd8;border-radius:10px;padding:10px 12px}',
      'button.lcbk-kpi{cursor:pointer}',
      'button.lcbk-kpi:hover{border-color:#3b6fd8}',
      'button.lcbk-kpi:focus-visible,.lcbk-tab tbody tr:focus-visible{outline:2px solid #3b6fd8;outline-offset:2px}',
      '.lcbk-kpi.is-alert{border-top-color:#c8372d}',
      '.lcbk-kpi.is-warn{border-top-color:#d99a1e}',
      '.lcbk-kpi.is-ok{border-top-color:#2e8b57}',
      '.lcbk-kpi .l{font-size:12px;color:#5e6c84;font-weight:600}',
      '.lcbk-kpi .v{font-size:26px;font-weight:700;color:#172b4d;line-height:1.2;margin-top:2px;font-variant-numeric:tabular-nums}',
      '.lcbk-kpi.is-alert .v{color:#c8372d}',
      '.lcbk-kpi .s{font-size:11.5px;color:#6b778c;margin-top:2px}',
      '.lcbk-tabwrap{max-height:340px;overflow:auto;border:1px solid #e3e6ec;border-radius:10px;background:#fff}',
      '.lcbk-tab{width:100%;border-collapse:collapse;font-size:12.5px}',
      '.lcbk-tab th{position:sticky;top:0;background:#f4f6f9;text-align:left;font-weight:600;color:#404857;padding:8px 10px;border-bottom:1px solid #e3e6ec}',
      '.lcbk-tab td{padding:7px 10px;border-bottom:1px solid #f0f2f5;color:#172b4d}',
      '.lcbk-tab td.num{text-align:right;font-variant-numeric:tabular-nums}',
      '.lcbk-tab td.is-late{color:#c8372d;font-weight:700}',
      '.lcbk-tab tbody tr{cursor:pointer}',
      '.lcbk-tab tbody tr:hover{background:#f7f9fc}',
      '.lcbk-tab tbody tr.is-on{background:#e8eefb}',
      '.lcbk-tab tbody tr.is-fila td{color:#6b778c;font-style:italic;cursor:default}',
      '.lcbk-prod{margin-top:16px}',
      '.lcbk-painel-head .lcbk-btn{margin-left:auto;padding:6px 10px}',
      '.lcbk-painel-head span.is-err{color:#a1281f}',
      '.lcbk-nota{font-size:11.5px;color:#6b778c;margin:8px 2px 0}',
      '.lcbk-cli{font-size:12.5px;font-weight:600;color:#1b2f5c;margin-top:3px}',
      '.lcbk-info{display:grid;grid-template-columns:1fr auto;gap:3px 10px;margin:7px 0 2px;padding:7px 9px;background:#f6f8fb;border-radius:6px;font-size:12px;align-items:baseline}',
      '.lcbk-info dd{white-space:nowrap}',
      '.lcbk-info dt{color:#6b778c;margin:0}',
      '.lcbk-info dd{margin:0;color:#172b4d;text-align:right;word-break:break-word}',
      '.lcbk-info dd.is-valor{font-weight:700;font-variant-numeric:tabular-nums}',
      '.lcbk-proc{font-size:11.5px;color:#6b778c;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lcbk-cpf{border:0;background:none;padding:0;font:inherit;font-weight:600;color:#172b4d;font-variant-numeric:tabular-nums;cursor:pointer;border-bottom:1px dashed #8993a4}',
      '.lcbk-cpf:focus-visible{outline:2px solid #3b6fd8;outline-offset:2px}',
      '.lcbk-proc strong{color:#172b4d;font-weight:600;font-variant-numeric:tabular-nums}',
      '.lcbk-info dd small{display:block;font-weight:400;font-size:10.5px;color:#6b778c}',
      '.lcbk-chip.is-ativo{background:#fff4e0;color:#8a5300}',
      '.lcbk-travado,.lcbk-travado body{overflow:hidden!important}',
      '.lcbk-gaveta{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.45);display:flex;flex-direction:column;padding:14px}',
      '.lcbk-gaveta-bar{display:flex;align-items:center;gap:12px;background:#fff;border-radius:12px 12px 0 0;padding:10px 14px;border-bottom:1px solid #e3e6ec}',
      '.lcbk-voltar{border:0;background:#1b2f5c;color:#fff;font-family:inherit;font-size:13.5px;font-weight:700;border-radius:8px;padding:9px 16px;cursor:pointer}',
      '.lcbk-voltar:hover{background:#25407a}',
      '.lcbk-voltar:focus-visible{outline:3px solid #8fb0f0;outline-offset:2px}',
      '.lcbk-gaveta-tit{flex:1;font-size:13px;color:#404857;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.lcbk-gaveta .lcbk-btn{text-decoration:none}',
      '.lcbk-gaveta-frame{flex:1;width:100%;border:0;background:#fff;border-radius:0 0 12px 12px}',
      '.lcbk-busca-vazia{grid-column:1 / -1;font-size:13px;color:#404857;background:#fff;border:1px dashed #c9cfda;border-radius:10px;padding:18px;margin:0}',
      '.lcbk-comigo.is-on{background:#1b2f5c;color:#fff;border-color:#1b2f5c}',
      '.lcbk-soma{color:#2e7d4f!important;font-weight:600}',
      '.lcbk-info dd.is-face{color:#2e7d4f;font-weight:700;font-variant-numeric:tabular-nums}',
      '.lcbk-info dd.is-desagio{color:#b8860b;font-weight:700}',
      '.lcbk-info dd.is-vazio{color:#6b778c;font-style:italic;font-weight:400}',
      '.lcbk-soma.is-prop{color:#1b2f5c!important}',
      '.lcbk-motivo{margin-top:6px;font-size:11.5px;line-height:1.35;color:#a1281f;background:#fbeceb;border-radius:6px;padding:6px 8px}',
      '.lcbk-motivo.is-pend{color:#7a4b00;background:#fff4e0}',
      '.lcbk-mais{width:100%;margin-top:4px;background:#fff}',
      '.lcbk-check{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#404857;cursor:pointer}',
      '.lcbk-chip.is-area{background:#f1f2f5;color:#404857}',
      '@media (max-width:768px){.lcbk-on .lcbk-board{grid-template-columns:repeat(var(--lcbk-cols,4),82vw)}.lcbk-status{margin-left:0}}',
      '@media (prefers-reduced-motion:reduce){.lcbk-card{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function shell(table) {
    css();
    ui.bar = el('div', 'lcbk-bar');
    var views = el('div', 'lcbk-group');
    views.setAttribute('role', 'group');
    views.setAttribute('aria-label', 'Visualiza\u00e7\u00e3o');
    views.appendChild(seg('Lista', 'lista'));
    views.appendChild(seg('Kanban', 'kanban'));
    ui.bar.appendChild(views);

    ui.tools = el('div', 'lcbk-tools');
    ui.layout = el('select', 'lcbk-select');
    ui.layout.setAttribute('aria-label', 'Disposi\u00e7\u00e3o do Kanban');
    ui.layout.addEventListener('change', function () {
      state.layout = ui.layout.value;
      ls(CFG.keys.layout, state.layout);
      render();
    });
    ui.tools.appendChild(ui.layout);

    ui.filtros = el('span', 'lcbk-filtros');
    ui.fDono = el('select', 'lcbk-select');
    ui.fDono.setAttribute('aria-label', 'Filtrar por dono');
    ui.fDono.addEventListener('change', function () { state.dono = ui.fDono.value; render(); });
    ui.fFase = el('select', 'lcbk-select');
    ui.fFase.setAttribute('aria-label', 'Filtrar por fase');
    [['', 'Todas as fases']].concat(CFG.tipos.map(function (t) { return [t[0], t[1]]; }))
      .forEach(function (t) { var o = el('option', null, t[1]); o.value = t[0]; ui.fFase.appendChild(o); });
    ui.fFase.addEventListener('change', function () { state.fase = ui.fFase.value; render(); });
    ui.filtros.appendChild(ui.fDono);
    ui.filtros.appendChild(ui.fFase);
    ui.tools.appendChild(ui.filtros);

    ui.search = el('input', 'lcbk-search');
    ui.search.type = 'search';
    ui.search.placeholder = 'Buscar n\u00ba, nome, CPF, processo ou atividade';
    ui.search.setAttribute('aria-label', 'Buscar no Kanban');
    var tb;
    ui.search.addEventListener('input', function () {
      clearTimeout(tb);
      tb = setTimeout(function () { state.busca = clean(ui.search.value); render(); }, 150);
    });
    ui.tools.appendChild(ui.search);

    var btn = el('button', 'lcbk-btn', 'Atualizar leads');
    btn.type = 'button';
    btn.addEventListener('click', buscar);
    if (CFG.acompanhamento.url) ui.tools.appendChild(btn);

    ui.btnTudo = el('button', 'lcbk-btn');
    ui.btnTudo.type = 'button';
    ui.btnTudo.style.display = 'none';
    ui.btnTudo.addEventListener('click', function () {
      if (LT.carregando) { LT.cancelar = true; return; }
      LT.erro = '';
      carregarTarefas();
    });
    ui.tools.appendChild(ui.btnTudo);
    ui.btnAtual = el('button', 'lcbk-btn', 'Atualizar');
    ui.btnAtual.type = 'button';
    ui.btnAtual.style.display = 'none';
    ui.btnAtual.title = 'Buscar de novo todas as p\u00e1ginas';
    ui.btnAtual.addEventListener('click', function () { LT.completo = null; LT.erro = ''; carregarTarefas(); });
    ui.tools.appendChild(ui.btnAtual);
    ui.status = el('span', 'lcbk-status');
    ui.status.setAttribute('aria-live', 'polite');
    ui.tools.appendChild(ui.status);
    ui.bar.appendChild(ui.tools);

    ui.resumo = el('div');
    ui.aviso = el('p', 'lcbk-aviso');
    ui.aviso.setAttribute('role', 'status');
    ui.aviso.style.display = 'none';
    ui.board = el('div', 'lcbk-board');
    table.parentNode.insertBefore(ui.bar, table);
    table.parentNode.insertBefore(ui.aviso, table);
    table.parentNode.insertBefore(ui.resumo, table);
    table.parentNode.insertBefore(ui.board, table.nextSibling);
  }

  // \u2550\u2550\u2550 BOOT \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  var timer;
  function schedule() { clearTimeout(timer); timer = setTimeout(render, 150); }

  function boot(tries) {
    if (tries === 0) vigiarAtualizacao();
    if (tries === 0) vigiarConsultas();
    var table = document.querySelector(CFG.sel.table);
    var root = document.querySelector(CFG.sel.root) || (table && table.parentNode);
    if (!table || !root) {
      if (tries < 40) setTimeout(function () { boot(tries + 1); }, 250);
      return;
    }
    shell(table);
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var t = recs[i].target;
        if (!ui.board.contains(t) && !ui.bar.contains(t) && !ui.resumo.contains(t) && !ui.aviso.contains(t)) { schedule(); return; }
      }
    }).observe(root, { childList: true, subtree: true, characterData: true });
    render();

    if (CFG.acompanhamento.url) {
      setTimeout(buscar, 600);                  // d\u00e1 tempo do cabe\u00e7alho do Zeev carregar o usu\u00e1rio
      setInterval(function () {
        if (document.visibilityState === 'visible') buscar();
      }, Math.max(1, CFG.acompanhamento.intervaloMin) * 60000);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && B.em &&
            Date.now() - B.em.getTime() > CFG.acompanhamento.intervaloMin * 60000) buscar();
      });
    }
  }


  // \u2550\u2550\u2550 ACOMPANHAR SOLICITA\u00c7\u00d5ES: Kanban das inst\u00e2ncias que a pessoa acompanha \u2550\u2550\u2550
  // L\u00ea a tabela que o pr\u00f3prio Zeev renderiza (p\u00e1gina atual, com os filtros da tela).
  // N\u00e3o l\u00ea CPF nem telefone: do resumo s\u00f3 aproveita a linha "Nome".
  var MESES = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
  function parsePrazoTexto(t) {
    t = lower(t);
    if (!t) return null;
    var m = t.match(/(\d{1,2})\/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\w*(?:\/(\d{2,4}))?/);
    if (m) {
      var hoje = new Date();
      var y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : hoje.getFullYear();
      var h = t.match(/(\d{1,2}):(\d{2})/);
      var d = new Date(y, MESES[m[2]], +m[1], h ? +h[1] : 23, h ? +h[2] : 59);
      if (!m[3] && hoje - d > 180 * DIA) d.setFullYear(y + 1);      // virada de ano
      return { date: d };
    }
    return parseDue({ textContent: t, querySelector: function () { return null; } });
  }

  function tabelaInst() {
    var td = document.querySelector(CFG.inst.cell);
    return td ? td.closest('table') : null;
  }

  // A coluna "Solicita\u00e7\u00e3o" n\u00e3o tem classe conhecida: \u00e9 a c\u00e9lula de texto mais longo que n\u00e3o
  // seja nenhuma das colunas identificadas (n\u00famero, datas, status, solicitante, atividade, a\u00e7\u00e3o).
  var CONHECIDAS = /instance-cell--(number|start|end|status|requester|current-activity|activity|action|select|checkbox)/;
  function celulaSolicitacao(tds) {
    var melhor = null, maior = -1;
    tds.forEach(function (td) {
      if (CONHECIDAS.test(td.className) || td.querySelector('input[type=checkbox]')) return;
      var n = (td.innerText || td.textContent || '').length;
      if (n > maior) { maior = n; melhor = td; }
    });
    return melhor;
  }

  // L\u00ea pares "R\u00f3tulo: valor" do resumo, pela ordem do texto (funciona com r\u00f3tulo em elemento
  // pr\u00f3prio, em negrito ou tudo num texto s\u00f3).
  function lerResumo(root) {
    if (!root) return [];
    var pares = [], atual = null, w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      var t = clean(n.nodeValue);
      if (!t) continue;
      var m = t.match(/^([^:]{2,60}?):\s*(.*)$/);
      if (m && /[A-Za-z\u00c0-\u00ff]/.test(m[1]) && !/^\d/.test(m[1]) && m[1].split(' ').length <= 8) {
        atual = { rotulo: clean(m[1]), valor: m[2] || '' };
        pares.push(atual);
      } else if (atual) {
        atual.valor = clean(atual.valor + ' ' + t);
      }
    }
    return pares;
  }
  function moeda(v) {
    v = clean(v);
    return /\d/.test(v) && !/^R\$/.test(v) ? 'R$ ' + v : v;
  }
  function infoResumo(root) {
    var R = CFG.resumo, info = {}, props = [];
    lerResumo(root).forEach(function (p) {
      var r = lower(p.rotulo);
      // CPF do CLIENTE (s\u00f3 ele): guardado formatado, para exibir mascarado ou completo
      if (/^cpf( do cliente| do autor)?$/.test(r)) {
        var mc = String(p.valor).match(/(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})/);
        if (mc && !info.cpf && R.cpf !== 'oculto') info.cpf = mc[1] + '.' + mc[2] + '.' + mc[3] + '-' + mc[4];
        return;
      }
      if (/cpf|cnpj|telefone|celular|whats|e-?mail|nascimento|endere|cep|\brg\b/.test(r)) return;   // nunca
      var v = semDoc(cortarRotulos(p.valor));
      if (!v) return;
      if (!info.nome && /^nome( do cliente| do autor| completo do cliente)?$/.test(r)) { info.nome = v; return; }
      if (!info.procNum && R.processo.test(r)) { info.procNum = v; return; }
      if (!info.face && R.face.test(r)) { info.face = moeda(v); return; }
      if (!info.tipo && R.tipo.test(r)) { info.tipo = v; return; }
      if (!info.desq && /desqualifica/.test(r)) { info.desq = v; return; }
      if (!info.viab && /^viabilidade/.test(r)) { info.viab = v; return; }
      if (/n[u\u00fa]mero/.test(r)) return;                       // "n\u00famero da proposta" n\u00e3o \u00e9 valor
      for (var i = 0; i < R.propostas.length; i++) {
        if (R.propostas[i][0].test(r) && /\d/.test(v)) { props.push({ ordem: i, valor: moeda(v), rotulo: R.propostas[i][1] }); break; }
      }
    });
    if (props.length) {
      props.sort(function (a, b) { return a.ordem - b.ordem; });
      info.proposta = props[0].valor;
      info.propostaRot = props[0].rotulo;
    }
    return info;
  }
  function htmlParaRaiz(h) { return h ? new DOMParser().parseFromString(String(h), 'text/html').body : null; }

  function nomeDaCelula(cel) {
    if (!cel) return '';
    var labels = cel.querySelectorAll('[class*="label"], b, strong, dt');
    for (var i = 0; i < labels.length; i++) {
      if (/^\s*nome( do cliente)?\s*:?\s*$/i.test(labels[i].textContent)) {
        // o valor pode ser um texto solto logo depois do r\u00f3tulo, ou o pr\u00f3ximo elemento
        var t = '', ns = labels[i].nextSibling, ne = labels[i].nextElementSibling;
        if (ns && ns.nodeType === 3 && clean(ns.nodeValue)) t = ns.nodeValue;
        else if (ne && !/:\s*$/.test(clean(ne.textContent))) t = ne.textContent;
        var nm = semDoc(cortarRotulos(t));
        if (nm) return nm;
        break;                                   // estrutura inesperada: tenta pelo texto
      }
    }
    var m = clean(cel.textContent).match(/nome( do cliente)?\s*:\s*(.*)$/i);
    return m ? semDoc(cortarRotulos(m[2])) : '';
  }

  // Total que o pr\u00f3prio Zeev informa ("213 inst\u00e2ncia(s) encontrada(s)" / "Pendentes (20 de 7513)")
  function totalZeev() {
    // s\u00f3 texto vis\u00edvel da p\u00e1gina: ignora <script>/<style>, que podem conter os mesmos modelos de frase
    var partes = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(p.nodeName)) return NodeFilter.FILTER_REJECT;
        if (ui.board && ui.board.contains(n)) return NodeFilter.FILTER_REJECT;
        if (uiI.board && uiI.board.contains(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }), n;
    while ((n = w.nextNode())) partes.push(n.nodeValue);
    var t = partes.join(' ');
    var m = t.match(/([\d.]+)\s*inst[a\u00e2]ncia\(s\)\s*encontrada/i) || t.match(/pendentes\s*\(\s*\d+\s*de\s*([\d.]+)\s*\)/i);
    return m ? parseInt(m[1].replace(/\./g, ''), 10) : null;
  }

  function lerInstancias() {
    var t = tabelaInst();
    if (!t) return [];
    var S = CFG.inst, now = new Date();
    return $$('tbody tr', t).filter(function (tr) { return tr.querySelector(S.cell); }).map(function (tr) {
      var tds = $$(':scope > td', tr);
      var cSol = tr.querySelector(S.solicitacao) || celulaSolicitacao(tds);
      var cAtv = tr.querySelector(S.atual);
      var cSt = tr.querySelector(S.status);
      var linhas = linhasDe(cSol);
      var nome = nomeDaCelula(cSol);
      var infoSol = infoResumo(cSol);
      var processo = semDoc(cortarRotulos(String(linhas[0] || '').replace(/nome( do cliente)?\s*:.*$/i, '')));
      var atividade = cAtv ? (txt(cAtv.querySelector(S.atividade)) || firstLine(cAtv)) : '';
      var resp = cAtv ? txt(cAtv.querySelector(S.responsavel)) : '';
      var prazoEl = cAtv && cAtv.querySelector(S.prazo);
      var prazoTxt = txt(prazoEl);
      var due = parsePrazoTexto(prazoTxt);
      var status = cSt ? (txt(cSt.querySelector('.badge')) || txt(cSt)) : '';
      var ativo = !status || /andamento/i.test(status);
      var late = ativo && (!!(prazoEl && prazoEl.classList.contains('text-danger')) ||
        !!(due && due.date && due.date < now));
      var fimTxt = txt(tr.querySelector(S.fim)).match(/\d{2}\/\d{2}\/\d{4}/);
      return {
        kind: 'inst', tr: tr,
        num: digits(txt(tr.querySelector(S.numero) || tds[0])),
        numero: txt(tr.querySelector(S.numero) || tds[0]) || ('#' + (tr.getAttribute('data-key') || '')),
        titulo: semDoc(nome || processo) || 'Solicita\u00e7\u00e3o',
        processo: nome ? semDoc(processo) : '',
        atividade: ativo ? atividade : '',
        quem: ativo ? resp.replace(/,\s*\+\d+\s*$/, '') : '',
        info: infoSol,
        fila: ativo && /,\s*\+\d+\s*$/.test(resp),
        mais: (resp.match(/,\s*\+(\d+)\s*$/) || [0, 0])[1] * 1,
        prazoTxt: prazoTxt, due: due, late: late,
        today: !late && !!(due && due.date && due.date.toDateString() === now.toDateString()),
        ativo: ativo, status: status,
        fimEm: fimTxt ? toDate(fimTxt[0]) : null,
        tipo: tipoDe(processo),
        stage: classificar(tipoDe(processo), atividade).etapa,
        area: classificar(tipoDe(processo), atividade).area
      };
    });
  }

  // Esteira comercial (Acompanhar/Monitorar): fecha como a Torre de Controle.
  //  Fundo & Cess\u00e3o = negocia\u00e7\u00e3o na T23/T24; Fechados (cess\u00e3o) = passou da T24 (T25, T27,
  //  acompanhamento do ativo) ou foi conclu\u00edda sem perda; Perdidas = encerrada como
  //  cancelada/recusada/reprovada/rejeitada.
  var RE_PERDA = /cancel|recus|reprov|rejeit|perd|desist|desqualif/i;
  function perdida(it) { return RE_PERDA.test((it.status || '') + ' ' + (it.resultado || '')); }
  // Triagem: lead rejeitado = desqualificado (motivo no resumo), viabilidade "desqualificado" ou encerrado como rejeitado/cancelado
  function rejeitadoTriagem(it) {
    var inf = it.info || {};
    return !!(inf.desq || /desqualific/i.test(inf.viab || '') || perdida(it));
  }
  function motivoRejeicao(it) {
    var inf = it.info || {};
    return clean(inf.desq) || (/desqualific/i.test(inf.viab || '') ? 'Desqualificado (motivo n\u00e3o informado)' : 'Motivo n\u00e3o informado');
  }
  function slug(t) { return 'm_' + lower(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 60); }
  var REJ = { cols: [] };          // colunas do pipeline Rejeitados (montadas a partir dos motivos da lista)
  function layoutEsteiraInst(id) {
    if (id === 'comercial') return {
      nome: CFG.esteiras[id].nome,
      esteira: id,
      cols: function () {
        var nomes = { ppp: 'PPP (cliente n\u00e3o responde)', negociacao: 'PPP Negocia\u00e7\u00e3o' };
        return colunasEsteira(id).filter(function (c) { return ['ppp', 'negociacao', 'proposta', 'pendencias'].indexOf(c.id) !== -1; })
          .map(function (c) { c.precisaB = false; if (nomes[c.id]) c.name = nomes[c.id]; return c; })
          .concat([{ id: 'fecCom', name: 'Proposta Aceita', ok: true, dica: 'em formaliza\u00e7\u00e3o (fora as pend\u00eancias)' },
                   { id: 'cessao', name: 'Proposta assinada pelo cliente', dica: 'T23 e T24 em andamento' },
                   { id: 'fechados', name: 'Fechados (PAGO)', ok: true, dica: 'passou da T24 ou conclu\u00edda', encerrada: true },
                   { id: 'perdJur', name: 'Perdidas \u00b7 rejeitada pelo jur\u00eddico', alert: true, dica: 'passou pela reprova\u00e7\u00e3o (T11, T15 ou T16)', encerrada: true },
                   { id: 'perdCli', name: 'Perdidas \u00b7 rejeitada pelo cliente', alert: true, dica: 'cancelada ou recusada pelo cliente', encerrada: true },
                   { id: 'perdNI', name: 'Perdidas \u00b7 motivo n\u00e3o identificado', alert: true, opcional: true, encerrada: true,
                     dica: PERDA.carregando ? 'lendo o hist\u00f3rico das negocia\u00e7\u00f5es\u2026' : 'hist\u00f3rico n\u00e3o dispon\u00edvel' },
                   { id: 'outros', name: 'Outras \u00e1reas', opcional: true, outras: true }]);
      },
      place: function (it) {
        if (it.tipo !== 'filho') {
          var c1 = it.ativo ? colunaDe(id, it) : 'outros';
          return ['ppp', 'negociacao', 'proposta', 'pendencias'].indexOf(c1) !== -1 ? c1 : 'outros';
        }
        if (!it.ativo) {
          if (!perdida(it)) return 'fechados';
          if (!PERDA.porSol && !PERDA.carregando && !PERDA.erro && listaPronta()) setTimeout(carregarMotivosPerda, 0);
          var mot = PERDA.porSol && PERDA.porSol[it.num];
          var idade = PERDA.em ? Date.now() - PERDA.em.getTime() : 0;
          if (!PERDA.carregando && PERDA.em && (idade > 30 * 60000 || (!mot && idade > 5 * 60000))) setTimeout(carregarMotivosPerda, 0);
          return mot === 'juridico' ? 'perdJur' : mot === 'cliente' ? 'perdCli' : 'perdNI';
        }
        if (it.stage === 'pos') return 'fechados';
        if (it.stage === 'cessao') return 'cessao';
        var c2 = colunaDe(id, it);
        if (c2 === 'pendencias') return 'pendencias';
        if (CFG.producao.posAceite.indexOf(codigoDe(it.atividade)) !== -1) return 'fecCom';
        return ['ppp', 'negociacao', 'proposta'].indexOf(c2) !== -1 ? c2 : 'outros';
      }
    };
    if (id === 'juridico') return {
      nome: CFG.esteiras[id].nome,
      esteira: id,
      cols: function () {
        return colunasEsteira(id).map(function (c) {
          c.precisaB = false;
          if (c.id === 'pos') { c.name = 'Pagos'; c.ok = true; c.encerrada = true; c.dica = 'passou da T24 ou conclu\u00edda'; }
          return c;
        })
          .concat([{ id: 'rejJur', name: 'Rejeitadas pelo Jur\u00eddico', alert: true, encerrada: true,
                     dica: PERDA.carregando ? 'lendo o hist\u00f3rico das negocia\u00e7\u00f5es\u2026' : 'passou pela reprova\u00e7\u00e3o (T11, T15 ou T16)' },
                   { id: 'outros', name: 'Outras \u00e1reas', opcional: true, outras: true }]);
      },
      place: function (it) {
        // mesma regra do comercial: Pagos = passou da T24 (p\u00f3s-cess\u00e3o) ou negocia\u00e7\u00e3o conclu\u00edda sem perda
        if (it.tipo === 'filho' && !it.ativo && !perdida(it)) return 'pos';
        if (!it.ativo) {
          if (it.tipo !== 'filho' || !perdida(it)) return 'outros';
          if (!PERDA.porSol && !PERDA.carregando && !PERDA.erro && listaPronta()) setTimeout(carregarMotivosPerda, 0);
          return PERDA.porSol && PERDA.porSol[it.num] === 'juridico' ? 'rejJur' : 'outros';
        }
        return colunaDe(id, it);
      }
    };
    if (id === 'triagem') return {
      nome: CFG.esteiras[id].nome,
      esteira: id,
      cols: function () {
        return colunasEsteira(id).filter(function (c) { return c.id !== 'negociacao'; })
          .map(function (c) { c.precisaB = false; return c; })
          .concat([{ id: 'rejeitadas', name: 'Rejeitadas', alert: true, encerrada: true },
                   { id: 'outros', name: 'Outras \u00e1reas', opcional: true, outras: true }]);
      },
      place: function (it) {
        if (!it.ativo) return it.tipo !== 'filho' && rejeitadoTriagem(it) ? 'rejeitadas' : 'outros';
        var c = colunaDe(id, it);
        return c === 'negociacao' ? 'outros' : c;
      }
    };
    return {
      nome: CFG.esteiras[id].nome,
      esteira: id,
      cols: function () {
        return colunasEsteira(id).map(function (c) { c.precisaB = false; return c; })
          .concat([{ id: 'outros', name: 'Outras \u00e1reas', opcional: true, outras: true },
                   { id: 'encerradas', name: 'Encerradas', ok: true, encerrada: true }]);
      },
      place: function (it) {
        // encerradas do Pai n\u00e3o interessam \u00e0s esteiras comercial e jur\u00eddica
        if (!it.ativo) return id === 'triagem' || it.tipo === 'filho' ? 'encerradas' : 'outros';
        return colunaDe(id, it);
      }
    };
  }
  var LAYOUTS_INST = {
    comercial: layoutEsteiraInst('comercial'),
    juridico: layoutEsteiraInst('juridico'),
    triagem: layoutEsteiraInst('triagem'),
    rejeitados: {
      nome: 'Rejeitados (por motivo)',
      esteira: 'rejeitados',
      cols: function () {
        return REJ.cols.concat([{ id: 'outros', name: 'Outras \u00e1reas', opcional: true, outras: true }]);
      },
      place: function (it) {
        if (it.ativo || it.tipo === 'filho' || !rejeitadoTriagem(it)) return 'outros';
        return slug(motivoRejeicao(it));
      }
    },
    status: {
      nome: 'Por status',
      cols: function () {
        return [
          { id: 'fila', name: 'Na fila', dica: 'Ningu\u00e9m assumiu ainda' },
          { id: 'andamento', name: 'Em andamento' },
          { id: 'atrasadas', name: 'Atrasadas', alert: true },
          { id: 'encerradas', name: 'Encerradas', ok: true }
        ];
      },
      place: function (it) {
        if (!it.ativo) return 'encerradas';
        if (it.late) return 'atrasadas';
        return it.fila ? 'fila' : 'andamento';
      }
    }
  };

  function abrirInstancia(it) {
    if (it.tr && document.contains(it.tr)) {
      var alvo = it.tr.querySelector('a[href]') || it.tr.querySelector(CFG.inst.acao) || it.tr;
      alvo.click();
    } else if (it.href) {
      location.assign(it.href);
    }
  }

  // \u2550\u2550\u2550 LISTA COMPLETA (todas as p\u00e1ginas da consulta atual) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  var LC = { url: '', base: '', completo: null, carregando: false, cancelar: false, prog: '', erro: '' };
  // URLs das consultas feitas pelo PR\u00d3PRIO Kanban: n\u00e3o podem ser lidas como "o Zeev trocou o filtro"
  var NOSSAS = {}, nNossas = 0;
  function nossa(href) { if (++nNossas > 4000) { NOSSAS = {}; nNossas = 1; } NOSSAS[href] = 1; return href; }
  function ehNossa(href) { return !!NOSSAS[href]; }
  function baseDe(u) {
    try { var x = new URL(u, location.origin); x.searchParams.delete('pagenumber'); x.searchParams.delete('recordsperpage'); return x.href; }
    catch (e) { return ''; }
  }
  // \u2500\u2500 Busca no pr\u00f3prio Zeev: usa a Palavra-chave da lista (mesma permiss\u00e3o da pessoa),
  //    para achar leads que ainda n\u00e3o foram carregados ou que est\u00e3o fora do recorte.
  var LB = { q: '', itens: [], carregando: false, erro: '', urls: {} }, tBusca;
  function buscarNoZeev(q) {
    clearTimeout(tBusca);
    if (!q || q.length < 3 || !LC.url) { LB.q = ''; LB.itens = []; LB.carregando = false; return; }
    tBusca = setTimeout(function () {
      var u = new URL(LC.url);
      u.searchParams.set('pagenumber', '1');
      u.searchParams.set('recordsperpage', '100');
      u.searchParams.set('keyword', q);
      LB.urls[u.href] = 1;
      LB.q = q; LB.carregando = true; LB.erro = '';
      renderInst();
      getJson(nossa(u.href)).then(function (j) {
        if (LB.q !== q) return;
        LB.itens = (((j && j.success) || {}).itens || []).map(function (x) { var it = daApi(x); it._busca = true; return it; });
      }).catch(function (e) {
        if (LB.q === q) { LB.itens = []; LB.erro = (e && e.message) || 'erro'; }
      }).then(function () {
        if (LB.q === q) { LB.carregando = false; renderInst(); }
      });
    }, 500);
  }
  // \u2500\u2500 "Comigo": solicita\u00e7\u00f5es em que a pessoa tem tarefa aberta agora (lista de tarefas dela)
  var MEU = { nums: null, em: null, carregando: false, erro: '' };
  function carregarMinhas() {
    if (MEU.carregando) return;
    MEU.carregando = true; MEU.erro = '';
    var nums = {}, p = 1;
    function prox() {
      return getJson('/api/internal/bpms/1.0/assignments?sortfield=dt&sortdirection=ASC&pageNumber=' + p + '&recordsPerPage=500')
        .then(function (j) {
          var sx = j && j.success, lote = (sx && sx.itens) || [];
          lote.forEach(function (x) { var n = digits(x.cfe); if (n) nums[n] = 1; });
          if (sx && sx.hasmoreitens && lote.length && p < 20) { p++; return prox(); }
        });
    }
    prox().then(function () { MEU.nums = nums; MEU.em = new Date(); })
      .catch(function (e) { MEU.erro = (e && e.message) || 'erro'; })
      .then(function () { MEU.carregando = false; renderInst(); });
  }

  function registrarUrl(u) {
    try {
      var x = new URL(u, location.origin);
      if (x.origin !== location.origin || !CFG.lista.padrao.test(x.pathname + x.search)) return;
      if (LB.urls[x.href] || ehNossa(x.href)) return;        // consultas do pr\u00f3prio Kanban
      var b = baseDe(x.href);
      if (LC.carregando && b === LC.base) return;            // s\u00e3o as nossas pr\u00f3prias consultas
      if (LC.carregando) LC.cancelar = true;                  // filtro mudou no meio da carga: para a antiga
      LC.url = x.href;
      if (b !== LC.base) { LC.reinicios = 0; LC.erro = ''; }    // lista nova: zera erros da anterior
      if (LC.completo && LC.completo.base !== b) { LC.completo = null; LC.erro = ''; }  // filtro mudou
      if (!LC.completo && !LC.carregando) setTimeout(function () { restaurarCache(b); }, 0);
      else if (LC.completo && !LC.carregando && velho(LC.completo)) setTimeout(carregarTudo, 300);
      LC.base = b;
      agendarAuto();
      if (uiI.board) { clearTimeout(timerI); timerI = setTimeout(renderInst, 150); }
    } catch (e) { /* ignora */ }
  }
  function textoDeHtml(h) {
    if (h == null) return '';
    if (!/[<&]/.test(String(h))) return clean(h);
    return clean(new DOMParser().parseFromString(String(h), 'text/html').body.textContent);
  }
  // Converte um item da API no mesmo formato dos cards. Do resumo, s\u00f3 o NOME \u00e9 aproveitado.
  function daApi(x) {
    var now = new Date();
    var processo = semDoc(textoDeHtml(x.serviceorflowname));
    var nome = '';
    var raizRes = htmlParaRaiz(x.resume);
    if (raizRes) nome = nomeDaCelula(raizRes);
    var infoApi = infoResumo(raizRes);
    var atividade = semDoc(textoDeHtml(x.tasktitle));
    var status = textoDeHtml(x.status);
    var ativo = !status || /andamento/i.test(status);
    var prazoTxt = clean([textoDeHtml(x.taskexpires), textoDeHtml(x.taskhrexpires)].filter(Boolean).join(' '));
    var due = parsePrazoTexto(prazoTxt);
    var rawCnt = String(x.taskcountresponsible || '');
    var cnt = parseInt(rawCnt.replace(/\D/g, ''), 10) || 0;
    var respTxt = textoDeHtml(x.taskresponsible);
    var fila = ativo && (/\+/.test(rawCnt) ? cnt > 0 : cnt > 1 || /,\s*\+\d+\s*$/.test(respTxt));
    var maisTxt = (respTxt.match(/,\s*\+(\d+)\s*$/) || [0, 0])[1] * 1;
    var mais = fila ? (maisTxt || (/\+/.test(rawCnt) ? cnt : Math.max(cnt - 1, 0))) : 0;
    var late = ativo && (/danger/i.test(String(x.taskslaclass || '')) || !!(due && due.date && due.date < now));
    var tipo = tipoDe(processo);
    var cl = classificar(tipo, atividade);
    return {
      kind: 'inst', tr: null, href: x.link ? sameOrigin(x.link) : null,
      num: digits(x.c), numero: '#' + digits(x.c),
      titulo: semDoc(nome || processo) || 'Solicita\u00e7\u00e3o',
      processo: nome ? processo : '',
      atividade: ativo ? atividade : '',
      quem: ativo ? semDoc(respTxt.replace(/,\s*\+\d+\s*$/, '')) : '',
      fila: fila, mais: mais, prazoTxt: ativo ? prazoTxt : '', due: due, late: late, info: infoApi,
      today: !late && !!(due && due.date && due.date.toDateString() === now.toDateString()),
      ativo: ativo, status: status, resultado: textoDeHtml(x.flowresult),
      fimEm: toDate(textoDeHtml(x.enddate)), inicioEm: toDate(textoDeHtml(x.startdate)),
      tipo: tipo, stage: cl.etapa, area: cl.area
    };
  }
  // \u2550\u2550\u2550 MODO FUNIL \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // Esteira comercial ou jur\u00eddica numa lista grande SEM filtro de fluxo: em vez da lista inteira,
  // o Kanban busca no Zeev s\u00f3 o que a esteira usa (mesma permiss\u00e3o e mesmos filtros da p\u00e1gina):
  //  jur\u00eddica = negocia\u00e7\u00f5es (Filhos), todas as situa\u00e7\u00f5es;
  //  comercial = Filhos + Pai, Carteira e Relacionamento EM ANDAMENTO (para o PPP).
  function modoNecessario() {
    if (LC.completo && LC.completo.daCopia && !totalZeev()) return LC.completo.funil || '';   // p\u00e1gina ainda sem total
    var lay = layoutInstAtivo();
    if ((lay !== 'comercial' && lay !== 'juridico') || !LC.url) return '';
    if (new URL(LC.url).searchParams.get('codFlowsOrServices')) return '';
    var t = totalZeev();
    return t && t > CFG.lista.funilAcima ? lay : '';
  }
  function serve(tem, precisa) {                               // a carga 'tem' atende a esteira 'precisa'?
    if (!precisa) return !tem;
    return !tem || tem === precisa || (precisa === 'juridico' && tem === 'comercial');
  }
  // valores e motivos s\u00f3 depois da lista: o Zeev atende uma consulta por vez por sess\u00e3o
  function listaPronta() { return !LC.carregando && (completoServe() || !!LC.erro); }
  function completoServe() {
    return !!(LC.completo && LC.completo.base === LC.base && serve(LC.completo.funil || '', modoNecessario()));
  }
  function fontesFunil(modo, u0) {
    var F = CFG.producao.fluxos, fontes = [];
    F.forEach(function (f) {
      var papel = f[2], status = null;
      if (papel !== 'filho') {
        if (modo !== 'comercial') return;
        status = 'S';                                         // Pai/Carteira/Relacionamento: s\u00f3 em andamento
      }
      var u = new URL(u0.href);
      u.searchParams.set('codFlowsOrServices', f[0] + ';' + f[1] + ';0;0');
      if (status && !u.searchParams.get('flowStatus')) u.searchParams.set('flowStatus', status);
      fontes.push(u.href);
    });
    return fontes;
  }
  function contar(href) {
    var u = new URL(href);
    u.pathname = u.pathname.replace(/\/instances\/?$/, '/instances/count');
    u.searchParams.delete('pagenumber'); u.searchParams.delete('recordsperpage');
    return getJson(nossa(u.href)).then(function (j) { return (j && j.success && +j.success.count) || 0; })
      .catch(function () { return 0; });
  }

  function carregarTudo() {
    if (LC.carregando || !LC.url) return;
    var modo = modoNecessario();
    if (modo) return carregarFunil(modo);
    var u0 = new URL(LC.url);
    var base = baseDe(u0.href);
    var total = totalZeev();
    var rpp = CFG.lista.tamanhoPagina, itens = [], vistos = {};
    LC.carregando = true; LC.cancelar = false; LC.erro = ''; LC.base = base; LC.parcial = itens;
    var acabou = false;
    function fim(msg) {
      if (acabou) return;
      acabou = true;
      LC.carregando = false; LC.prog = ''; LC.parcial = null;
      if (LC.cancelar) setTimeout(agendarAuto, 50);          // come\u00e7a a carga da lista nova
      if (msg) { LC.erro = msg; LC.completo = null; }
      else if (!LC.cancelar) {
        LC.reinicios = 0;
        LC.completo = { base: base, itens: itens, em: new Date(), total: total,
                        limitado: !!(total && total > itens.length && itens.length >= CFG.lista.maxItens) };
        setTimeout(salvarCache, 0);
      }
      renderInst();
    }
    function pagina(p) {
      var u = new URL(u0.href);
      u.searchParams.set('pagenumber', String(p));
      u.searchParams.set('recordsperpage', String(rpp));
      return getJson(nossa(u.href)).then(function (j) {
        var sx = j && j.success, lote = (sx && sx.itens) || [];
        lote.forEach(function (x) {
          var it = daApi(x);
          if (it.num && !vistos[it.num]) { vistos[it.num] = 1; itens.push(it); }
        });
        return { mais: !!(sx && sx.hasmoreitens), n: lote.length };
      });
    }
    var tRender = 0;
    function progresso() {
      LC.prog = 'Carregando ' + fmtN(itens.length) + (total ? ' de ' + fmtN(total) : '') + '\u2026';
      var agora = Date.now();
      if (agora - tRender > 400) { tRender = agora; renderInst(); }
    }
    function mudou() { return LC.cancelar || base !== LC.base; }
    progresso();
    // 1\u00aa p\u00e1gina: descobre o tamanho real da p\u00e1gina; depois as outras v\u00e3o em paralelo
    pagina(1).then(function (r1) {
      if (mudou()) { LC.cancelar = true; return fim(''); }
      if (!r1.mais || !r1.n) return fim('');
      if (r1.n < rpp) rpp = r1.n;                           // o Zeev limitou o tamanho da p\u00e1gina
      var limite = Math.min(total || CFG.lista.maxItens, CFG.lista.maxItens);
      var ultima = Math.max(2, Math.ceil(limite / rpp));
      var prox = 2, ativos = 0, parar = false;
      function disparar() {
        if (mudou()) { LC.cancelar = true; return fim(''); }
        if (parar && !ativos) return fim('');
        while (!parar && ativos < CFG.lista.paralelo && prox <= ultima) {
          (function (p) {
            ativos++;
            pagina(p).then(function (r) {
              ativos--;
              if (acabou) return;                                   // carga j\u00e1 encerrada: descarta
              if (mudou()) { LC.cancelar = true; return fim(''); }   // filtro mudou: troca em sil\u00eancio
              if (!r.n || !r.mais) { if (p >= ultima || !r.n) parar = true; }
              var tAgora = totalZeev();
              if (tAgora && itens.length > tAgora + rpp) {          // est\u00e1 lendo outra lista
                LC.reinicios = (LC.reinicios || 0) + 1;
                if (LC.reinicios > 2) return fim('a lista mudou durante a carga; clique em Atualizar');
                LC.cancelar = true; return fim('');
              }
              if (itens.length >= CFG.lista.maxItens) parar = true;
              progresso();
              disparar();
            }).catch(function (e) { ativos--; if (acabou) return; parar = true; fim('n\u00e3o foi poss\u00edvel carregar a lista completa (' + (e && e.message) + ')'); });
          })(prox++);
        }
        if (prox > ultima && !ativos) {
          // o total da p\u00e1gina pode estar desatualizado: se a \u00faltima ainda tinha mais, continua uma a uma
          parar = true;
          return fim('');
        }
      }
      disparar();
    }).catch(function (e) { fim('n\u00e3o foi poss\u00edvel carregar a lista completa (' + (e && e.message) + ')'); });
  }
  function carregarFunil(modo) {
    var u0 = new URL(LC.url), base = baseDe(u0.href);
    var fontes = fontesFunil(modo, u0), itens = [], vistos = {}, acabou = false, total = 0;
    LC.carregando = true; LC.cancelar = false; LC.erro = ''; LC.base = base; LC.parcial = itens;
    var tRender = 0;
    function progresso() {
      LC.prog = 'Carregando o funil ' + (modo === 'comercial' ? 'comercial' : 'jur\u00eddico') + ': ' + fmtN(itens.length) + (total ? ' de ' + fmtN(total) : '') + '\u2026';
      if (Date.now() - tRender > 400) { tRender = Date.now(); renderInst(); }
    }
    function mudou() { return LC.cancelar || base !== LC.base || !serve(modo, modoNecessario()); }
    function fim(msg) {
      if (acabou) return;
      acabou = true;
      LC.carregando = false; LC.prog = ''; LC.parcial = null;
      var trocou = LC.cancelar || base !== LC.base || !serve(modo, modoNecessario());
      if (msg) { LC.erro = msg; LC.completo = null; }
      else if (!trocou) {
        LC.completo = { base: base, itens: itens, em: new Date(), total: itens.length, funil: modo };
        setTimeout(salvarCache, 0);
      }
      if (trocou) setTimeout(agendarAuto, 50);
      renderInst();
    }
    function pagina(href, p, rpp) {
      var u = new URL(href);
      u.searchParams.set('pagenumber', String(p));
      u.searchParams.set('recordsperpage', String(rpp));
      return getJson(nossa(u.href)).then(function (j) {
        var sx = j && j.success, lote = (sx && sx.itens) || [];
        lote.forEach(function (x) {
          var it = daApi(x);
          if (it.num && !vistos[it.num]) { vistos[it.num] = 1; itens.push(it); }
        });
        return lote.length;
      });
    }
    function lerFonte(href) {
      return contar(href).then(function (n) {
        total += n;
        var rpp = CFG.lista.tamanhoPagina;
        if (!n) return pagina(href, 1, rpp);                  // sem contagem: s\u00f3 a 1\u00aa p\u00e1gina
        var paginas = Math.ceil(n / rpp), prox = 1, ativos = 0;
        return new Promise(function (ok, erro) {
          function disparar() {
            if (acabou || mudou()) return ok();
            if (prox > paginas && !ativos) return ok();
            while (ativos < CFG.lista.paralelo && prox <= paginas) {
              ativos++;
              pagina(href, prox++, rpp).then(function () { ativos--; progresso(); disparar(); }, function (e) { ativos--; erro(e); });
            }
          }
          disparar();
        });
      });
    }
    progresso();
    var i = 0;
    (function prox() {
      if (acabou) return;
      if (mudou()) { LC.cancelar = true; return fim(''); }
      if (i >= fontes.length) return fim('');
      lerFonte(fontes[i++]).then(prox, function (e) { fim('n\u00e3o foi poss\u00edvel carregar o funil (' + (e && e.message) + ')'); });
    })();
  }

  var tAuto;
  function agendarAuto() {
    clearTimeout(tAuto);
    tAuto = setTimeout(function () {
      var total = totalZeev();
      if (!completoServe() && !LC.carregando && !LC.erro && LC.url && total && total <= CFG.lista.autoAte) carregarTudo();
    }, 1200);                                                // espera o Zeev aplicar o filtro salvo
  }
  // \u2500\u2500 atualiza\u00e7\u00e3o autom\u00e1tica: rel\u00ea a lista completa em segundo plano quando ela fica velha.
  // Os cards antigos continuam na tela at\u00e9 a nova leitura terminar (troca sem piscar).
  function velho(completo) {
    if (!completo) return false;
    var min = completo.itens.length > CFG.lista.grande ? CFG.lista.atualizarMinGrande : CFG.lista.atualizarMin;
    return Date.now() - completo.em.getTime() > min * 60000;
  }
  function vigiarAtualizacao() {
    var checar = function () {
      if (document.visibilityState !== 'visible') return;
      if (MODO === 'tarefas') {
        if (!LT.carregando && LT.completo && LT.completo.base === LT.base && velho(LT.completo)) { buscarContagem(); carregarTarefas(); }
      } else if (!LC.carregando && completoServe() && velho(LC.completo)) {
        carregarTudo();
      }
    };
    setInterval(checar, 30000);
    document.addEventListener('visibilitychange', checar);
    return checar;
  }

  // \u2550\u2550\u2550 C\u00d3PIA LOCAL DA LISTA (abre na hora ao voltar para a tela) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // A lista carregada \u00e9 guardada no IndexedDB do navegador CRIPTOGRAFADA (AES-GCM 256). A chave
  // fica s\u00f3 no sessionStorage desta aba: fechou a aba, a c\u00f3pia fica ileg\u00edvel e \u00e9 apagada na pr\u00f3xima
  // abertura. Validade: CFG.lista.cacheHoras. Sem WebCrypto/IndexedDB, simplesmente n\u00e3o usa c\u00f3pia.
  var CACHE = { db: null, chave: null, ok: !!(window.crypto && crypto.subtle && window.indexedDB) };
  function b64(buf) { var s2 = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s2 += String.fromCharCode(a[i]); return btoa(s2); }
  function deB64(t) { return Uint8Array.from(atob(t), function (c) { return c.charCodeAt(0); }); }
  function abrirCache() {
    if (!CACHE.ok) return Promise.reject(new Error('sem suporte'));
    if (CACHE.pronto) return CACHE.pronto;
    var novaAba = !sessionStorage.getItem('lcbkCk');
    CACHE.pronto = new Promise(function (ok, erro) {
      var req = indexedDB.open('lcbkCache', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('listas', { keyPath: 'k' }); };
      req.onerror = function () { erro(req.error); };
      req.onsuccess = function () { ok(req.result); };
    }).then(function (db) {
      CACHE.db = db;
      if (novaAba) {                                          // chave nova: o que havia n\u00e3o serve mais
        return new Promise(function (ok) {
          var tx = db.transaction('listas', 'readwrite'); tx.objectStore('listas').clear();
          tx.oncomplete = ok; tx.onerror = ok;
        }).then(function () {
          return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        }).then(function (k) {
          CACHE.chave = k;
          return crypto.subtle.exportKey('raw', k).then(function (raw) { sessionStorage.setItem('lcbkCk', b64(raw)); return db; });
        });
      }
      return crypto.subtle.importKey('raw', deB64(sessionStorage.getItem('lcbkCk')), 'AES-GCM', false, ['encrypt', 'decrypt'])
        .then(function (k) { CACHE.chave = k; return db; });
    });
    return CACHE.pronto;
  }
  function idCache(base) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(base)).then(function (h) { return b64(h); });
  }
  function salvarCache() {
    if (!CACHE.ok || !LC.completo) return;
    var base = LC.completo.base, chaveC = base + '|' + (LC.completo.funil || '');
    try { sessionStorage.setItem('lcbkUlt:' + location.pathname, JSON.stringify({ base: base, funil: LC.completo.funil || '' })); } catch (e) { /* ignora */ }
    var pacote = {
      itens: LC.completo.itens.map(function (it) { var c = {}; for (var k in it) if (k !== 'tr') c[k] = it[k]; return c; }),
      funil: LC.completo.funil || '',
      em: LC.completo.em, total: LC.completo.total,
      form: FORM.base === base ? { porSol: FORM.porSol, em: FORM.em } : null,
      perda: PERDA.porSol ? { porSol: PERDA.porSol, em: PERDA.em } : null
    };
    abrirCache().then(function (db) {
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return Promise.all([idCache(chaveC), crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, CACHE.chave,
        new TextEncoder().encode(JSON.stringify(pacote)))]).then(function (r) {
        var tx = db.transaction('listas', 'readwrite');
        tx.objectStore('listas').put({ k: r[0], iv: iv, dados: r[1], em: Date.now() });
      });
    }).catch(function () { /* sem c\u00f3pia local: segue normal */ });
  }
  var RE_DATA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  function restaurarCache(base, funilSalvo) {
    if (!CACHE.ok || CACHE.restaurando === base) return;
    CACHE.restaurando = base;
    var precisa = funilSalvo != null ? funilSalvo : modoNecessario();
    var chaves = precisa === 'juridico' ? ['juridico', 'comercial'] : [precisa];
    abrirCache().then(function (db) {
      var tentar = function (ix) {
        if (ix >= chaves.length) return Promise.resolve(null);
        return lerReg(db, base + '|' + chaves[ix]).then(function (r) { return r || tentar(ix + 1); });
      };
      return tentar(0);
    }).then(function (p2) {
      if (!p2 || LC.completo || LC.base !== base) return;
      var agora = new Date();
      p2.itens.forEach(function (it) { if (it.ativo && it.due && it.due.date) it.late = it.due.date < agora; });
      LC.completo = { base: base, itens: p2.itens, em: new Date(p2.em), total: p2.total, daCopia: true, funil: p2.funil || '' };
      if (p2.form && !FORM.em) { FORM.porSol = p2.form.porSol; FORM.em = new Date(p2.form.em); FORM.base = base; }
      if (p2.perda && !PERDA.porSol) { PERDA.porSol = p2.perda.porSol; PERDA.em = new Date(p2.perda.em); }
      renderInst();
      setTimeout(function () { if (!LC.carregando) carregarTudo(); }, 300);   // atualiza em segundo plano
    }).catch(function () { /* c\u00f3pia ileg\u00edvel ou ausente: carga normal */ })
      .then(function () { if (CACHE.restaurando === base) CACHE.restaurando = null; });
  }
  function lerReg(db, chave) {
    return idCache(chave).then(function (id) {
      return new Promise(function (ok) {
        var req = db.transaction('listas').objectStore('listas').get(id);
        req.onsuccess = function () { ok(req.result); }; req.onerror = function () { ok(null); };
      });
    }).then(function (reg) {
      if (!reg || Date.now() - reg.em > CFG.lista.cacheHoras * 3600000) return null;
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: reg.iv }, CACHE.chave, reg.dados).then(function (buf) {
        return JSON.parse(new TextDecoder().decode(buf), function (k, v) { return typeof v === 'string' && RE_DATA_ISO.test(v) ? new Date(v) : v; });
      });
    });
  }
  function restaurarCacheAntigo(base) {
    abrirCache().then(function (db) {
      return idCache(base).then(function (id) {
        return new Promise(function (ok) {
          var req = db.transaction('listas').objectStore('listas').get(id);
          req.onsuccess = function () { ok(req.result); }; req.onerror = function () { ok(null); };
        });
      }).then(function (reg) {
        if (!reg || Date.now() - reg.em > CFG.lista.cacheHoras * 3600000) return null;
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: reg.iv }, CACHE.chave, reg.dados).then(function (buf) {
          return JSON.parse(new TextDecoder().decode(buf), function (k, v) { return typeof v === 'string' && RE_DATA_ISO.test(v) ? new Date(v) : v; });
        });
      });
    }).then(function (p2) {
      if (!p2 || LC.completo || LC.base !== base) return;
      var agora = new Date();
      p2.itens.forEach(function (it) {                        // atraso recalculado para agora
        if (it.ativo && it.due && it.due.date) it.late = it.due.date < agora;
      });
      LC.completo = { base: base, itens: p2.itens, em: new Date(p2.em), total: p2.total, daCopia: true };
      if (p2.form && !FORM.em) { FORM.porSol = p2.form.porSol; FORM.em = new Date(p2.form.em); FORM.base = base; }
      if (p2.perda && !PERDA.porSol) { PERDA.porSol = p2.perda.porSol; PERDA.em = new Date(p2.perda.em); }
      renderInst();
      setTimeout(function () { if (!LC.carregando) carregarTudo(); }, 300);   // atualiza em segundo plano
    }).catch(function () { /* c\u00f3pia ileg\u00edvel ou ausente: carga normal */ })
      .then(function () { if (CACHE.restaurando === base) CACHE.restaurando = null; });
  }

  function itensDaLista() {
    if (completoServe()) return LC.completo.itens.slice();
    if (LC.carregando && LC.parcial && LC.parcial.length) return LC.parcial.slice();   // vai preenchendo
    return lerInstancias();
  }

  // "Fila da triagem: Ingrid, Wagner, R\u00e9gis, Gabriel" para filas conhecidas;
  // sen\u00e3o "Fila: <1\u00ba nome> e mais N" (o Zeev n\u00e3o informa os outros nomes).
  // Time de cada processo, pela \u00e1rea da atividade atual. Encerrados n\u00e3o t\u00eam atividade:
  // os do Pai/Relacionamento contam na Triagem; os do Filho, em Comercial e Jur\u00eddico.
  var NOMES_TIME = { triagem: 'Triagem', comercial: 'Comercial', juridico: 'Jur\u00eddico' };
  var AREA_TIME = { triagem: 'triagem', comercial: 'comercial', financeiro: 'comercial',
                    juridico: 'juridico', conselho: 'juridico' };
  function timeDe(it) {
    if (it.ativo) return AREA_TIME[it.area] || (it.tipo !== 'filho' ? 'triagem' : '');
    return it.tipo === 'filho' ? 'filho' : 'triagem';
  }

  // Fila = ningu\u00e9m assumiu. Nunca \u00e9 atribu\u00edda a uma pessoa.
  function rotuloFila(it) {
    var cod = codigoDe(it.atividade);
    for (var i = 0; i < CFG.filas.length; i++) {
      var f = CFG.filas[i];
      if (f[0] === it.tipo && f[1] === cod) return 'Na fila: ' + f[2] + ' (' + f[3].split(',').length + ' pessoas)';
    }
    return 'Na fila: ' + (cod || 'grupo') + (it.mais ? ' (' + (it.mais + 1) + ' pessoas)' : '');
  }
  function membrosFila(it) {
    var cod = codigoDe(it.atividade);
    for (var i = 0; i < CFG.filas.length; i++) {
      var f = CFG.filas[i];
      if (f[0] === it.tipo && f[1] === cod) return f[3];
    }
    return it.quem + (it.mais ? ' e mais ' + it.mais : '');
  }

  function cardInst(it, layoutId) {
    var c = el('article', 'lcbk-card' + (it.late ? ' is-late' : it.today ? ' is-today' : '') +
      (!it.ativo ? ' is-done' : ''));
    c.tabIndex = 0;
    c.setAttribute('role', 'button');
    c.setAttribute('aria-label', 'Abrir ' + it.numero + ' ' + it.titulo);
    c.addEventListener('click', function (e) {
      var a = it.tr && it.tr.querySelector('a[href]');
      var url = it.href || (a && a.getAttribute('href'));
      abrirComTecla(e, url, it.numero + ' \u00b7 ' + it.titulo, function () { abrirInstancia(it); });
    });
    c.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); }
    });
    var top = el('div', 'lcbk-top');
    top.appendChild(el('span', 'lcbk-num', it.numero));
    var flag = !it.ativo ? [(it.resultado && it.resultado !== it.status ? it.resultado : it.status) || 'Encerrada', perdida(it) ? 'is-lost' : 'is-done'] :
      it.late ? ['Atrasada', ''] : it.today ? ['Vence hoje', 'is-today'] :
      it.fila ? ['Na fila', 'is-stuck'] : null;
    if (flag) top.appendChild(el('span', 'lcbk-flag ' + flag[1], flag[0]));
    c.appendChild(top);
    c.appendChild(el('div', 'lcbk-title', it.titulo));
    if (it.processo) c.appendChild(el('div', 'lcbk-app', it.processo));
    if (it.atividade) c.appendChild(el('div', 'lcbk-app lcbk-atv', it.atividade));
    blocoInfo(c, it.info, false, it._col && it._col.id);
    var tags = el('div', 'lcbk-tags');
    tags.appendChild(el('span', 'lcbk-tipo is-' + it.tipo, NOME_TIPO[it.tipo] || NOME_TIPO.pai));
    chipTipo(tags, it.info);
    if (it.ativo && it.stage && it.stage !== 'outros' && !(it._col && it._col.unica) &&
        !(it.tipo !== 'filho' && it.stage === 'triagem')) {
      tags.appendChild(el('span', 'lcbk-chip', NOME_ETAPA[it.stage] || it.stage));
    }
    if (it.ativo && it.area && it._col && it._col.outras) {
      tags.appendChild(el('span', 'lcbk-chip is-area', CFG.nomesArea[it.area] || it.area));
    }
    c.appendChild(tags);
    var foot = el('div', 'lcbk-foot');
    if (it.ativo) {
      if (it.prazoTxt) foot.appendChild(el('span', 'lcbk-due', 'Prazo: ' + it.prazoTxt));
      if (it.quem) {
        var w = el('span', 'lcbk-who', it.fila ? 'Na fila \u00b7 ningu\u00e9m assumiu' : 'Com ' + it.quem);
        if (it.fila) w.title = 'Pode ser assumida por: ' + membrosFila(it);
        foot.appendChild(w);
      }
    } else if (it.fimEm) {
      foot.appendChild(el('span', 'lcbk-due', 'Encerrada em ' + fmtData(it.fimEm)));
    }
    c.appendChild(foot);
    return c;
  }

  var stInst = {
    view: ls(CFG.keys.viewInst) || 'kanban',
    layout: LAYOUTS_INST[ls(CFG.keys.layoutInst)] ? ls(CFG.keys.layoutInst) : '',   // vazio = autom\u00e1tico
    outras: ls('lcbKanbanOutras') === '1',
    ator: '',
    etapa: '',
    comigo: false,
    lim: {},
    painel: ls('lcbKanbanPainel') !== '0',
    time: ['triagem', 'comercial', 'juridico'].indexOf(ls('lcbKanbanTime')) !== -1 ? ls('lcbKanbanTime') : '',
    totalConfirmado: '',
    busca: ''
  };
  var uiI = {};

  var ESTEIRA_INST_PADRAO = { comercial: 'comercial', juridico: 'juridico', triagem: 'triagem' };
  function layoutInstAtivo() {
    return LAYOUTS_INST[stInst.layout] ? stInst.layout :
      (ESTEIRA_INST_PADRAO[ls('lcbKanbanArea')] || 'comercial');
  }

  // \u2550\u2550\u2550 PRODU\u00c7\u00c3O (LOG DE TAREFAS) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // Uma tarefa finalizada hoje (ou no m\u00eas) pertence a uma solicita\u00e7\u00e3o EM ANDAMENTO ou ENCERRADA
  // no per\u00edodo. Por isso o log \u00e9 pedido nesses dois recortes, fluxo a fluxo. Se um export vier com
  // 1.000 linhas (corte silencioso do Zeev), o per\u00edodo da solicita\u00e7\u00e3o \u00e9 dividido at\u00e9 caber.
  // Do CSV s\u00f3 ficam: n\u00ba, tarefa, ator, time, solicitante, datas e status. O resto \u00e9 descartado.
  var PROD = { carregando: false, erro: '', em: null, dados: null, consultas: 0, incompleto: 0, prog: '' };
  function ddmmaaaa(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
  function lerData(txt) {
    var m = clean(txt).match(/(\d{2})\/(\d{2})\/(\d{4})(?:\D+(\d{1,2}):(\d{2}))?/);
    return m ? new Date(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 0, m[4] ? +m[5] : 0) : null;
  }
  function lerCsv(txt) {
    var rows = [], row = [], f = '', q = false, c;
    if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
    for (var i = 0; i < txt.length; i++) {
      c = txt[i];
      if (q) {
        if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
      } else if (c === '"') q = true;
      else if (c === ';') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || clean(r[0]); });
  }
  function decodificar(conteudo) {
    var t = String(conteudo || '');
    if (/^[A-Za-z0-9+\/=\s]+$/.test(t.slice(0, 400))) {
      try { t = new TextDecoder('utf-8').decode(Uint8Array.from(atob(t.replace(/\s/g, '')), function (ch) { return ch.charCodeAt(0); })); }
      catch (e) { /* n\u00e3o era base64 */ }
    }
    return t;
  }
  // baixa o log de um recorte; devolve s\u00f3 os campos necess\u00e1rios
  function baixarLog(fluxo, flowStatus, ini, fim, extra, est) {
    var q = 'reportType=ihavepermission&taskStatus=S&flowStatus=' + flowStatus +
      '&codFlowsOrServices=' + encodeURIComponent(fluxo[0] + ';' + fluxo[1] + ';0;0') +
      '&startBegin=' + encodeURIComponent(ddmmaaaa(ini)) + '&startEnd=' + encodeURIComponent(ddmmaaaa(fim)) + (extra || '');
    (est || PROD).consultas++;
    return getJson('/api/internal/bpms/1.0/instances/export/tasks/csvsemicolon?' + q).then(function (j) {
      var linhas = lerCsv(decodificar(j && j.success && j.success.fileContent));
      if (!linhas.length) return { n: 0, itens: [] };
      var h = linhas[0].map(clean), ix = function (nome) { return h.indexOf(nome); };
      var I = { sol: ix('N\u00famero da solicita\u00e7\u00e3o'), tipo: ix('Tipo de solicita\u00e7\u00e3o'), solic: ix('Solicitante / Nome'),
        tarefa: ix('Tarefa'), ator: ix('Ator / Nome'), time: ix('Ator / Time'), rec: ix('Data de recebimento'),
        hrec: ix('Hor\u00e1rio de recebimento'), fin: ix('Data de finaliza\u00e7\u00e3o'), hfin: ix('Hor\u00e1rio de finaliza\u00e7\u00e3o'),
        st: ix('Status da tarefa'), inst: ix('N\u00famero da inst\u00e2ncia da tarefa') };
      var itens = linhas.slice(1).map(function (r) {
        var g = function (k) { return I[k] >= 0 ? clean(r[I[k]]) : ''; };
        return { sol: digits(g('sol')), papel: fluxo[2], solic: semDoc(g('solic')), cod: codigoDe(g('tarefa')),
          ator: semDoc(g('ator')), time: g('time'), rec: lerData(g('rec') + ' ' + g('hrec')),
          fin: lerData(g('fin') + ' ' + g('hfin')), st: g('st'), inst: g('inst') || (g('sol') + '|' + g('tarefa') + '|' + g('rec')) };
      });
      return { n: linhas.length - 1, itens: itens };
    });
  }
  // divide o per\u00edodo da solicita\u00e7\u00e3o at\u00e9 cada parte vir abaixo do corte de 1.000 linhas
  // O Zeev atende uma consulta por vez: exports pesados esperam a carga da lista terminar.
  function esperarLista() {
    return new Promise(function (ok) {
      (function v() { if (!LC.carregando) ok(); else setTimeout(v, 300); })();
    });
  }
  function baixarRecorte(fluxo, flowStatus, ini, fim, extra, acc, est) {
    return (est === PROD ? Promise.resolve() : esperarLista()).then(function () {
      return baixarLog(fluxo, flowStatus, ini, fim, extra, est);
    }).then(function (res) {
      if (res.n >= CFG.producao.limiteLinhas) {
        var dias = Math.round((fim - ini) / DIA);
        if (dias < 1) { (est || PROD).incompleto++; res.itens.forEach(function (x) { acc.push(x); }); return; }
        var meio = new Date(ini.getTime() + Math.floor(dias / 2) * DIA);
        var depois = new Date(meio.getTime() + DIA);
        return baixarRecorte(fluxo, flowStatus, ini, meio, extra, acc, est)
          .then(function () { return baixarRecorte(fluxo, flowStatus, depois, fim, extra, acc, est); });
      }
      res.itens.forEach(function (x) { acc.push(x); });
    });
  }
  // \u2550\u2550\u2550 VALORES E MOTIVOS (formul\u00e1rio das negocia\u00e7\u00f5es) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  function parseValor(v) {
    v = String(v || '').replace(/[^\d,.-]/g, '');
    if (!v) return 0;
    if (/,\d{1,2}$/.test(v)) return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
    if (/\.\d{1,2}$/.test(v) && v.indexOf(',') === -1) return parseFloat(v.replace(/,/g, '')) || 0;
    return parseFloat(v.replace(/[.,]/g, '')) || 0;
  }
  function moedaBR(n) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }
  var FORM = { porSol: {}, carregando: false, erro: '', em: null, base: '', incompleto: 0 };
  function lerFormCsv(txt, por) {
    var linhas = lerCsv(txt);
    if (!linhas.length) return 0;
    var h = linhas[0].map(clean), F = CFG.producao.form;
    var ix = function (nome) { return h.indexOf(nome); };
    var iSol = ix('N\u00famero da solicita\u00e7\u00e3o');
    var candProp = [];
    // pareceres das propostas do sucumbencial: qual proposta cada um avalia (DF, 2\u00aa ou 1\u00aa)
    var parecerSuc = [];
    h.forEach(function (n, i) {
      if (!/parecer/i.test(n) || !/sucumb/i.test(n)) return;
      var qual = /PDF|DF|diretor/i.test(n) ? 'pdf' : /SP|segund/.test(n) || /segund/i.test(n) ? 'sp' : 'pp';
      parecerSuc.push({ i: i, qual: qual });
    });
    // "Valor de Face" de partes que n\u00e3o s\u00e3o o autor nem o advogado contratual (vF..., ex.: sucumbencial)
    var candFace = [];
    h.forEach(function (n, i) {
      if ((/^vF[A-Z]/.test(n) && ['vFA', 'vFHC'].indexOf(n) === -1) || (/sucumb/i.test(n) && /face/i.test(n))) candFace.push(i);
    });
    h.forEach(function (n, i) {
      if (!/propost/i.test(n) && !/^vP[A-Z]|^vSP|^vPDF/.test(n)) return;
      if (/^p[A-Z]|^d[A-Z]|^jR/.test(n)) return;                    // % , des\u00e1gio e juros (pPP, dPP, jRPP)
      if (/numero|n[u\u00fa]mero|parecer|justific|des[a\u00e1]gio|anexo|img|pdf$|txt|canva|evidenc|print|descri|motivo|observ|status|data|prazo|fundo|face|sucumb/i.test(n)) return;
      var rank = /corrig/i.test(n) ? 0 : /novo|nova/i.test(n) ? 1 : /pdf|diretor|\bdf/i.test(n) ? 2 : /segund|^vSP/i.test(n) ? 3 : 4;
      var rot = ['corrigida', 'nova proposta', 'diretor financeiro', '2\u00aa proposta', 'proposta'][rank];
      candProp.push({ i: i, rank: rank, rot: rot });
    });
    var pega = function (r, nomes) {
      for (var i = 0; i < nomes.length; i++) { var k = ix(nomes[i]); if (k >= 0 && clean(r[k])) return clean(r[k]); }
      return '';
    };
    linhas.slice(1).forEach(function (r) {
      var sol = digits(r[iSol]);
      if (!sol) return;
      var o = { face: parseValor(pega(r, F.face)) };
      for (var i = 0; i < F.propostas.length; i++) {
        var k = ix(F.propostas[i][0]);
        if (k >= 0 && parseValor(r[k])) { o.prop = parseValor(r[k]); o.propRot = F.propostas[i][1]; break; }
      }
      // Advogado Sucumbencial (nomes exatos)
      if (!o.prop && F.sucumbencial) {
        var S = F.sucumbencial, faceS = parseValor(pega(r, S.face));
        // 1\u00ba crit\u00e9rio: a proposta cujo PARECER \u00e9 "Proposta Aceita" (mais recente primeiro: DF > 2\u00aa > 1\u00aa)
        var aceitas = {};
        parecerSuc.forEach(function (ps) { if (/aceit/i.test(clean(r[ps.i])) && !/n[a\u00e3]o aceit|recus/i.test(clean(r[ps.i]))) aceitas[ps.qual] = 1; });
        ['pdf', 'sp', 'pp'].some(function (qual, qi) {
          if (!aceitas[qual]) return false;
          var kq = ix(S.propostas[qi][0]), vq = kq >= 0 ? parseValor(r[kq]) : 0;
          if (!vq) return false;
          o.prop = vq; o.propRot = S.propostas[qi][2];
          if (faceS) { o.face = faceS; o.faceRot = 'honor\u00e1rios'; }
          if (!o.nProp) o.nProp = semDoc(pega(r, S.numeroProposta));
          return true;
        });
      }
      // 2\u00ba crit\u00e9rio (sem parecer): a mais recente preenchida, ignorando o preenchimento autom\u00e1tico
      if (!o.prop && F.sucumbencial) {
        var S = F.sucumbencial, faceS = parseValor(pega(r, S.face));
        for (var si = 0; si < S.propostas.length; si++) {
          var kv = ix(S.propostas[si][0]), kd = ix(S.propostas[si][1]);
          var vs = kv >= 0 ? parseValor(r[kv]) : 0;
          if (!vs) continue;
          var ds = kd >= 0 && clean(r[kd]) !== '' ? parseValor(r[kd]) : null;
          if (faceS && ds === 0 && Math.abs(vs - faceS) < 0.01) continue;   // preenchimento autom\u00e1tico
          o.prop = vs; o.propRot = S.propostas[si][2];
          if (faceS) { o.face = faceS; o.faceRot = 'honor\u00e1rios'; }
          if (!o.nProp) o.nProp = semDoc(pega(r, S.numeroProposta));
          break;
        }
      }
      // Fluxos/partes com outros nomes de campo: procura qualquer
      // coluna de VALOR de proposta e fica com a mais recente (corrigida > nova > diretor financeiro > 2\u00aa > demais).
      if (!o.prop) {
        var melhor = null;
        candProp.forEach(function (cp) {
          var bruto = clean(r[cp.i]);
          if (!bruto || !/^[R$\s\d.,-]+$/.test(bruto)) return;
          var v = parseValor(bruto);
          if (!v) return;
          if (!melhor || cp.rank < melhor.rank || (cp.rank === melhor.rank && cp.i > melhor.i)) melhor = { v: v, rank: cp.rank, i: cp.i, rot: cp.rot };
        });
        if (melhor) {
          o.prop = melhor.v; o.propRot = melhor.rot;
          // Advogado Sucumbencial (e outras partes): o valor de face \u00e9 o dos HONOR\u00c1RIOS dessa parte
          // ("Valor de Face" da se\u00e7\u00e3o dela), n\u00e3o o Valor Total do Cr\u00e9dito Principal.
          var faceParte = 0;
          candFace.forEach(function (cf) { if (!faceParte) faceParte = parseValor(r[cf]); });
          if (faceParte) { o.face = faceParte; o.faceRot = 'honor\u00e1rios'; }
        }
      }
      o.tipo = semDoc(pega(r, F.tipo));
      o.nProp = semDoc(pega(r, F.numeroProposta));
      o.fundo = semDoc(pega(r, F.fundo));
      var corta = function (t) { t = semDoc(t); return t.length > 220 ? t.slice(0, 217) + '\u2026' : t; };
      o.motJur = corta(pega(r, F.motivoJuridico));
      o.motCli = corta(pega(r, F.motivoCliente));
      var pend = [];
      F.pendencias.forEach(function (nome) { var k = ix(nome); if (k >= 0 && clean(r[k]) && pend.length < 2 && pend.indexOf(clean(r[k])) === -1) pend.push(clean(r[k])); });
      o.pend = corta(pend.join(' \u00b7 '));
      por[sol] = o;
    });
    return linhas.length - 1;
  }
  function carregarFormularios() {
    if (FORM.carregando || !LC.url) return;
    FORM.carregando = true; FORM.erro = ''; FORM.incompleto = 0;
    var base = LC.base || baseDe(LC.url), por = {};
    var filhos = CFG.producao.fluxos.filter(function (f) { return f[2] === 'filho'; });
    var i = 0;
    function prox() {
      if (i >= filhos.length) return Promise.resolve();
      var f = filhos[i++], u = new URL(base);
      u.pathname = u.pathname.replace(/\/instances\/?$/, '/instances/export/requests/csvsemicolon');
      ['pagenumber', 'recordsperpage', 'keyword'].forEach(function (k) { u.searchParams.delete(k); });
      u.searchParams.set('codFlowsOrServices', f[0] + ';' + f[1] + ';0;0');
      return esperarLista().then(function () { return getJson(nossa(u.href)); }).then(function (j) {
        var n = lerFormCsv(decodificar(j && j.success && j.success.fileContent), por);
        if (n >= CFG.producao.limiteLinhas) FORM.incompleto++;
      }).then(prox);
    }
    prox().then(function () { FORM.porSol = por; FORM.em = new Date(); FORM.base = base; setTimeout(salvarCache, 0); })
      .catch(function (e) { FORM.erro = (e && e.message) || 'erro'; })
      .then(function () { FORM.carregando = false; if (uiI.board) renderInst(); });
  }
  function enriquecer(it) {
    var f = FORM.porSol[it.num];
    if (!f) return;
    var inf = it.info || (it.info = {});
    if (f.face) { inf.faceN = f.face; inf.face = moedaBR(f.face); inf.faceRot = f.faceRot || ''; }
    if (f.prop) { inf.propN = f.prop; inf.proposta = moedaBR(f.prop); inf.propostaRot = f.propRot; }
    else if (f.face) { inf.semProposta = true; }
    if (f.face && f.prop) inf.desagio = Math.max(0, 1 - f.prop / f.face);
    if (f.tipo && !inf.tipo) inf.tipo = f.tipo;
    inf.nProp = f.nProp; inf.fundo = f.fundo;
    inf.motJur = f.motJur; inf.motCli = f.motCli; inf.pend = f.pend;
  }

  var PERDA = { porSol: null, carregando: false, erro: '', em: null, consultas: 0, incompleto: 0 };
  function carregarMotivosPerda() {
    if (PERDA.carregando) return;
    PERDA.carregando = true; PERDA.erro = ''; PERDA.consultas = 0; PERDA.incompleto = 0;
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var base = lerData(CFG.producao.inicioBase) || new Date(2020, 0, 1);
    var acc = [];
    var filhos = CFG.producao.fluxos.filter(function (f) { return f[2] === 'filho'; });
    var maisAntiga = null;
    (LC.completo ? LC.completo.itens : []).forEach(function (it) {
      if (it.tipo === 'filho' && !it.ativo && perdida(it) && it.fimEm && (!maisAntiga || it.fimEm < maisAntiga)) maisAntiga = it.fimEm;
    });
    var extraP = '';
    if (maisAntiga) {
      var d0 = new Date(maisAntiga.getFullYear(), maisAntiga.getMonth(), maisAntiga.getDate());
      extraP = '&endBegin=' + encodeURIComponent(ddmmaaaa(d0)) + '&endEnd=' + encodeURIComponent(ddmmaaaa(hoje));
    }
    var i = 0;
    function prox() {
      if (i >= filhos.length) return Promise.resolve();
      return baixarRecorte(filhos[i++], 'N', base, hoje, extraP, acc, PERDA).then(prox);
    }
    prox().then(function () {
      var cods = {};
      acc.forEach(function (x) { if (x.sol) (cods[x.sol] = cods[x.sol] || {})[x.cod] = 1; });
      var por = {};
      Object.keys(cods).forEach(function (sol) {
        por[sol] = CFG.producao.perdaJuridico.some(function (c) { return cods[sol][c]; }) ? 'juridico' : 'cliente';
      });
      PERDA.porSol = por; PERDA.em = new Date();
      setTimeout(salvarCache, 0);
    }).catch(function (e) {
      PERDA.erro = (e && e.message) || 'erro';
    }).then(function () {
      PERDA.carregando = false; acc = null;
      if (uiI.board) renderInst();
    });
  }

  function carregarProducao() {
    if (PROD.carregando) return;
    PROD.carregando = true; PROD.erro = ''; PROD.consultas = 0; PROD.incompleto = 0;
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var mes1 = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    var base = lerData(CFG.producao.inicioBase) || new Date(2020, 0, 1);
    var acc = [];
    var encMes = '&endBegin=' + encodeURIComponent(ddmmaaaa(mes1)) + '&endEnd=' + encodeURIComponent(ddmmaaaa(hoje));
    var fila = [];
    CFG.producao.fluxos.forEach(function (f) {
      fila.push([f, 'S', '']);        // em andamento
      fila.push([f, 'N', encMes]);    // encerradas no m\u00eas
    });
    var i = 0;
    function proximo() {
      if (i >= fila.length) return Promise.resolve();
      var t = fila[i++];
      PROD.prog = 'Lendo o log de tarefas (' + i + ' de ' + fila.length + ')\u2026';
      if (typeof renderInst === 'function' && uiI.painel) renderInst();
      return baixarRecorte(t[0], t[1], base, hoje, t[2], acc).then(proximo);
    }
    proximo().then(function () {
      PROD.dados = calcularProducao(acc, hoje, mes1);
      PROD.em = new Date();
    }).catch(function (e) {
      PROD.erro = 'n\u00e3o foi poss\u00edvel ler o log de tarefas (' + (e && e.message) + ')';
    }).then(function () {
      PROD.carregando = false; PROD.prog = '';
      acc = null;                                             // descarta o log bruto
      if (uiI.painel) renderInst();
    });
  }
  function calcularProducao(acc, hoje, mes1) {
    var amanha = new Date(hoje.getTime() + DIA);
    var noDia = function (d) { return d && d >= hoje && d < amanha; };
    var noMes = function (d) { return d && d >= mes1 && d < amanha; };
    var P = CFG.producao;
    // deduplica por inst\u00e2ncia da tarefa, preferindo a linha finalizada (regra da Torre)
    var porInst = {};
    acc.forEach(function (x) {
      var k = x.inst, a = porInst[k];
      if (!a || (!a.fin && x.fin)) porInst[k] = x;
    });
    var linhas = Object.keys(porInst).map(function (k) { return porInst[k]; });
    var timeDoAtor = {};
    linhas.forEach(function (x) { if (x.ator && x.time && !timeDoAtor[x.ator]) timeDoAtor[x.ator] = x.time; });
    var pessoas = {};
    var pessoa = function (nome, time) {
      var p = pessoas[nome] || (pessoas[nome] = { nome: nome, time: '', hoje: 0, triHoje: 0, triMes: 0, comHoje: 0, comMes: 0, forHoje: 0, forMes: 0 });
      if (!p.time) p.time = time || timeDoAtor[nome] || '';
      return p;
    };
    var tot = { tarefasHoje: 0, triHoje: 0, triMes: 0, comHoje: 0, comMes: 0, forHoje: 0, forMes: 0 };
    // produ\u00e7\u00e3o e triagem
    linhas.forEach(function (x) {
      if (!x.ator || !x.fin) return;
      if (noDia(x.fin)) { pessoa(x.ator, x.time).hoje++; tot.tarefasHoje++; }
      if (x.papel === 'pai' && x.cod === P.triagem) {
        if (noDia(x.fin)) { pessoa(x.ator, x.time).triHoje++; tot.triHoje++; }
        if (noMes(x.fin)) { pessoa(x.ator, x.time).triMes++; tot.triMes++; }
      }
    });
    // fechamentos: por negocia\u00e7\u00e3o (Filho), atribu\u00eddos ao dono
    var negs = {};
    linhas.forEach(function (x) {
      if (x.papel !== 'filho') return;
      var n = negs[x.sol] || (negs[x.sol] = { solic: x.solic, t01: '', aceite: null, formal: null });
      if (x.cod === 'T01' && x.ator && !n.t01) n.t01 = x.ator;
      if (x.cod === P.aceite && x.rec && (!n.aceite || x.rec < n.aceite)) n.aceite = x.rec;
      if (x.cod === P.formal && x.fin && (!n.formal || x.fin < n.formal)) n.formal = x.fin;
    });
    var ehSdr = function (nome) {
      return P.sdr.some(function (s) { return lower(nome).indexOf(lower(s)) === 0; });
    };
    Object.keys(negs).forEach(function (k) {
      var n = negs[k];
      var dono = (!n.solic || ehSdr(n.solic)) && n.t01 ? n.t01 : n.solic;
      if (!dono) dono = 'Sem dono identificado';
      if (noDia(n.aceite)) { pessoa(dono).comHoje++; tot.comHoje++; }
      if (noMes(n.aceite)) { pessoa(dono).comMes++; tot.comMes++; }
      if (noDia(n.formal)) { pessoa(dono).forHoje++; tot.forHoje++; }
      if (noMes(n.formal)) { pessoa(dono).forMes++; tot.forMes++; }
    });
    // s\u00e9ries do m\u00eas, dia a dia (triagens e aceites)
    var dias = [];
    for (var d = new Date(mes1); d < amanha; d = new Date(d.getTime() + DIA)) dias.push({ d: new Date(d), tri: 0, com: 0 });
    var idx = function (dt) { return dt ? Math.floor((new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()) - mes1) / DIA) : -1; };
    linhas.forEach(function (x) {
      if (x.papel === 'pai' && x.cod === P.triagem && noMes(x.fin)) { var i = idx(x.fin); if (dias[i]) dias[i].tri++; }
    });
    Object.keys(negs).forEach(function (k) {
      var n = negs[k]; if (noMes(n.aceite)) { var i = idx(n.aceite); if (dias[i]) dias[i].com++; }
    });
    return { tot: tot, dias: dias, pessoas: Object.keys(pessoas).map(function (k) { return pessoas[k]; }) };
  }

  function timeDoNome(t) {
    t = lower(t);
    return /tria/.test(t) ? 'triagem' : /jur/.test(t) ? 'juridico' : /comerc|vend/.test(t) ? 'comercial' : '';
  }

  // \u2550\u2550\u2550 VIS\u00c3O DO GESTOR \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // Painel do gestor: s\u00f3 em Monitorar > Solicita\u00e7\u00f5es E s\u00f3 para quem ativou a chave no navegador
  // (link ?lcbGestor=on). Quem protege os DADOS \u00e9 a permiss\u00e3o de Monitorar do Zeev; a chave
  // decide apenas quem v\u00ea o painel entre as pessoas que j\u00e1 t\u00eam essa permiss\u00e3o.
  var EH_GESTOR = CFG.pathGestor.test(location.pathname) && ls(CFG.keys.gestor) === 'on';
  function mesmoDia(d) { return !!(d && d.toDateString() === new Date().toDateString()); }
  function kpi(rotulo, valor, sub, tom, onClick) {
    var c = el(onClick ? 'button' : 'div', 'lcbk-kpi' + (tom ? ' is-' + tom : ''));
    if (onClick) { c.type = 'button'; c.addEventListener('click', onClick); }
    c.appendChild(el('div', 'l', rotulo));
    c.appendChild(el('div', 'v', fmtN(valor)));
    if (sub) c.appendChild(el('div', 's', sub));
    return c;
  }
  var COR_TIME = { triagem: '#6a3fb5', comercial: '#1d5fbf', juridico: '#0f7a6c', '': '#7a8394' };
  function vizBox(titulo, sub) {
    var box = el('section', 'lcbk-viz');
    var h = el('header', 'lcbk-viz-head');
    h.appendChild(el('h3', null, titulo));
    if (sub) h.appendChild(el('p', null, sub));
    box.appendChild(h);
    return box;
  }
  // barras horizontais: [{nome, a, b, cor, rotulo, nota, ativo, onClick}] (a = parte forte, b = parte clara)
  function barras(box, linhas, vazio, maxLinhas) {
    if (!linhas.length) { box.appendChild(el('p', 'lcbk-viz-vazio', vazio)); return box; }
    var max = Math.max.apply(null, linhas.map(function (l) { return (l.a || 0) + (l.b || 0); })) || 1;
    var ol = el('ol', 'lcbk-bars');
    linhas.slice(0, maxLinhas || 10).forEach(function (l) {
      var li = el('li', 'lcbk-bar' + (l.ativo ? ' is-on' : ''));
      li.appendChild(el('span', 'lcbk-bar-nome', l.nome));
      var tr = el('span', 'lcbk-bar-trilho');
      var f1 = el('span', 'lcbk-bar-f'); f1.style.width = ((l.a || 0) * 100 / max) + '%'; f1.style.background = l.cor;
      tr.appendChild(f1);
      if (l.b) { var f2 = el('span', 'lcbk-bar-f is-claro'); f2.style.width = (l.b * 100 / max) + '%'; f2.style.background = l.cor; tr.appendChild(f2); }
      li.appendChild(tr);
      li.appendChild(el('span', 'lcbk-bar-num', l.rotulo != null ? l.rotulo : fmtN(l.a || 0)));
      if (l.nota) li.appendChild(el('span', 'lcbk-bar-nota', l.nota));
      if (l.onClick) {
        li.tabIndex = 0; li.setAttribute('role', 'button');
        li.addEventListener('click', l.onClick);
        li.addEventListener('keydown', function (e) { if (e.key === 'Enter') l.onClick(); });
      }
      ol.appendChild(li);
    });
    box.appendChild(ol);
    if (linhas.length > (maxLinhas || 10)) box.appendChild(el('p', 'lcbk-viz-mais', 'e mais ' + (linhas.length - (maxLinhas || 10)) + ' pessoas'));
    return box;
  }
  // colunas por dia do m\u00eas, com o dia de hoje em destaque
  function colunasDia(box, dias, campo, cor) {
    var max = Math.max.apply(null, dias.map(function (x) { return x[campo]; })) || 1;
    var g = el('div', 'lcbk-dias');
    g.setAttribute('role', 'img');
    g.setAttribute('aria-label', dias.map(function (x) { return x.d.getDate() + ': ' + x[campo]; }).join(', '));
    dias.forEach(function (x, i) {
      var hoje = i === dias.length - 1;
      var c = el('div', 'lcbk-dia' + (hoje ? ' is-hoje' : ''));
      c.title = fmtData(x.d) + ': ' + x[campo];
      var bar = el('span', 'lcbk-dia-bar'); bar.style.height = Math.max(2, x[campo] * 100 / max) + '%'; bar.style.background = cor;
      if (hoje || x[campo] === max) c.appendChild(el('span', 'lcbk-dia-v', fmtN(x[campo])));
      c.appendChild(bar);
      c.appendChild(el('span', 'lcbk-dia-d', String(x.d.getDate())));
      g.appendChild(c);
    });
    box.appendChild(g);
    return box;
  }

  function renderPainel(lidos, completo, total) {
    var p = uiI.painel;
    if (!EH_GESTOR || !stInst.painel || stInst.view !== 'kanban') { p.style.display = 'none'; return; }
    p.style.display = '';
    var ativos = lidos.filter(function (it) { return it.ativo; });
    var de = function (t) { return ativos.filter(function (it) { return timeDe(it) === t; }); };
    var tri = de('triagem'), com = de('comercial'), jur = de('juridico');
    var d = PROD.dados;
    var filtrar = function (time, layout) {
      return function () {
        stInst.time = time; stInst.ator = ''; ls('lcbKanbanTime', time);
        if (layout) { stInst.layout = layout; ls(CFG.keys.layoutInst, layout); }
        renderInst();
        if (uiI.board.scrollIntoView) uiI.board.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    };
    var frag = document.createDocumentFragment();

    // cabe\u00e7alho
    var head = el('div', 'lcbk-g-head');
    var tt = el('div');
    tt.appendChild(el('h2', null, 'Opera\u00e7\u00e3o agora'));
    var base = completo ? 'Todas as ' + fmtN(lidos.length) + ' solicita\u00e7\u00f5es da lista'
      : 'Carregando: ' + fmtN(lidos.length) + (total ? ' de ' + fmtN(total) : '') + ' solicita\u00e7\u00f5es';
    var prodTxt = PROD.carregando ? PROD.prog : PROD.erro ? PROD.erro
      : PROD.em ? 'produ\u00e7\u00e3o lida \u00e0s ' + PROD.em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    tt.appendChild(el('p', null, base + (prodTxt ? '. ' + prodTxt.charAt(0).toUpperCase() + prodTxt.slice(1) : '')));
    head.appendChild(tt);
    var bt = el('button', 'lcbk-btn', PROD.carregando ? 'Atualizando produ\u00e7\u00e3o\u2026' : 'Atualizar produ\u00e7\u00e3o');
    bt.type = 'button'; bt.disabled = PROD.carregando;
    bt.addEventListener('click', carregarProducao);
    head.appendChild(bt);
    frag.appendChild(head);
    if (PROD.incompleto) frag.appendChild(el('p', 'lcbk-aviso', 'Parte do log veio cortada em 1.000 linhas mesmo num \u00fanico dia: produ\u00e7\u00e3o e fechamentos podem estar menores que o real.'));

    // funil
    var etapas = [
      { n: tri.filter(function (it) { return it.fila; }).length, t: 'na fila da triagem', s: 'ningu\u00e9m assumiu', cor: '#8a6bd1', f: filtrar('triagem', 'status') },
      { n: tri.filter(function (it) { return !it.fila; }).length, t: 'em an\u00e1lise na triagem', s: d ? fmtN(d.tot.triHoje) + ' analisadas hoje' : '', cor: COR_TIME.triagem, f: filtrar('triagem', 'status') },
      { n: com.length, t: 'no comercial', s: com.filter(function (it) { return it.late; }).length + ' atrasadas', cor: COR_TIME.comercial, f: filtrar('comercial', 'comercial') },
      { n: jur.length, t: 'no jur\u00eddico', s: jur.filter(function (it) { return it.late; }).length + ' atrasadas', cor: COR_TIME.juridico, f: filtrar('juridico', 'juridico') },
      { n: d ? d.tot.comHoje : null, t: 'propostas aceitas hoje', s: d ? fmtN(d.tot.comMes) + ' no m\u00eas' : 'lendo o log\u2026', cor: '#2e7d4f' },
      { n: d ? d.tot.forHoje : null, t: 'cess\u00f5es protocoladas hoje', s: d ? fmtN(d.tot.forMes) + ' no m\u00eas' : 'lendo o log\u2026', cor: '#1f5e3b' }
    ];
    var fun = el('div', 'lcbk-funil');
    fun.setAttribute('role', 'list');
    etapas.forEach(function (e, i) {
      var b = el(e.f ? 'button' : 'div', 'lcbk-etapa' + (i === 0 ? ' is-primeira' : ''));
      b.setAttribute('role', 'listitem');
      b.style.setProperty('--c', e.cor);
      if (e.f) { b.type = 'button'; b.addEventListener('click', e.f); b.title = 'Ver no quadro'; }
      b.appendChild(el('span', 'n', e.n == null ? '\u2026' : fmtN(e.n)));
      b.appendChild(el('span', 't', e.t));
      if (e.s) b.appendChild(el('span', 's', e.s));
      fun.appendChild(b);
    });
    frag.appendChild(fun);
    var late = ativos.filter(function (it) { return it.late; }).length;
    if (late) {
      var al = el('button', 'lcbk-alerta');
      al.type = 'button';
      al.addEventListener('click', filtrar('', 'status'));
      al.appendChild(el('strong', null, fmtN(late) + ' atrasadas'));
      al.appendChild(document.createTextNode(' de ' + fmtN(ativos.length) + ' em andamento (' + Math.round(late * 100 / Math.max(ativos.length, 1)) + '%)'));
      frag.appendChild(al);
    }

    // \u2500\u2500 cards por pessoa, agrupados por time \u2500\u2500
    var verPessoa = function (nome) {
      return function () {
        stInst.ator = stInst.ator === nome ? '' : nome; renderInst();
        if (stInst.ator && uiI.board.scrollIntoView) uiI.board.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    };
    var gente = {};
    var g = function (nome) {
      return gente[nome] || (gente[nome] = { nome: nome, time: '', maos: 0, late: 0, antigo: null,
        hoje: 0, triHoje: 0, triMes: 0, comHoje: 0, comMes: 0, forMes: 0 });
    };
    ativos.forEach(function (it) {
      if (!it.quem || it.fila) return;
      var r = g(it.quem);
      r.maos++;
      if (!r.time) r.time = timeDe(it);
      if (it.late) {
        r.late++;
        if (it.due && it.due.date && (!r.antigo || it.due.date < r.antigo)) r.antigo = it.due.date;
      }
    });
    if (d) d.pessoas.forEach(function (x) {
      var r = g(x.nome);
      ['hoje', 'triHoje', 'triMes', 'comHoje', 'comMes', 'forMes'].forEach(function (k) { r[k] = x[k]; });
      var t = timeDoNome(x.time);
      if (t) r.time = t;
    });
    var iniciais = function (n) {
      var p2 = n.split(' ').filter(Boolean);
      return ((p2[0] || '')[0] || '') + ((p2.length > 1 ? p2[p2.length - 1] : '')[0] || '');
    };
    var cartao = function (r, principal, rotulo, sub, extras) {
      var c = el('button', 'lcbk-pc' + (stInst.ator === r.nome ? ' is-on' : '') + (r.late ? ' tem-atraso' : ''));
      c.type = 'button';
      c.style.setProperty('--c', COR_TIME[r.time] || COR_TIME['']);
      c.title = 'Ver no quadro o que est\u00e1 com ' + r.nome;
      c.addEventListener('click', verPessoa(r.nome));
      var topo = el('div', 'lcbk-pc-topo');
      topo.appendChild(el('span', 'lcbk-av', iniciais(r.nome).toUpperCase()));
      topo.appendChild(el('span', 'lcbk-pc-nome', r.nome));
      c.appendChild(topo);
      var big = el('div', 'lcbk-pc-big');
      big.appendChild(el('span', 'n', principal == null ? '\u2026' : fmtN(principal)));
      big.appendChild(el('span', 'l', rotulo));
      c.appendChild(big);
      if (sub) c.appendChild(el('div', 'lcbk-pc-sub', sub));
      var lin = el('div', 'lcbk-pc-lin');
      extras.filter(function (e) { return e.n || e.sempre; }).forEach(function (e) {
        var x = el('span', 'lcbk-pc-x' + (e.alerta ? ' is-alerta' : ''));
        x.appendChild(el('strong', null, fmtN(e.n)));
        x.appendChild(document.createTextNode(' ' + e.t));
        lin.appendChild(x);
      });
      c.appendChild(lin);
      if (r.antigo) {
        var dd = Math.floor((Date.now() - r.antigo.getTime()) / DIA);
        c.appendChild(el('div', 'lcbk-pc-alerta', 'Atraso mais antigo: ' + dd + (dd === 1 ? ' dia' : ' dias')));
      }
      return c;
    };
    var todosG = Object.keys(gente).map(function (k) { return gente[k]; });
    var secao = function (time, titulo, chips, ordem, montar) {
      if (stInst.time && stInst.time !== time) return;
      var lista = todosG.filter(function (r) { return r.time === time; }).sort(ordem);
      var sec = el('section', 'lcbk-time-sec');
      sec.style.setProperty('--c', COR_TIME[time]);
      var h = el('header', 'lcbk-time-head');
      h.appendChild(el('h3', null, titulo));
      chips.forEach(function (ch) { h.appendChild(el('span', 'lcbk-chip-t' + (ch.alerta ? ' is-alerta' : ''), ch.t)); });
      sec.appendChild(h);
      var grade = el('div', 'lcbk-pc-grade');
      if (!lista.length) grade.appendChild(el('p', 'lcbk-viz-vazio', d ? 'Ningu\u00e9m com atividade neste time agora.' : 'Lendo o log de tarefas\u2026'));
      lista.forEach(function (r) { grade.appendChild(montar(r)); });
      sec.appendChild(grade);
      frag.appendChild(sec);
    };
    var somaG = function (time, k) { return todosG.filter(function (r) { return r.time === time; }).reduce(function (a, r) { return a + r[k]; }, 0); };
    var plural = function (n, um, varios) { return fmtN(n) + ' ' + (n === 1 ? um : varios); };

    secao('comercial', 'Comercial', [
      { t: d ? plural(d.tot.comMes, 'proposta aceita no m\u00eas', 'propostas aceitas no m\u00eas') : 'lendo o log\u2026' },
      { t: d ? plural(d.tot.forMes, 'cess\u00e3o protocolada', 'cess\u00f5es protocoladas') : '' },
      { t: plural(somaG('comercial', 'late'), 'atrasada', 'atrasadas'), alerta: somaG('comercial', 'late') > 0 }
    ].filter(function (x) { return x.t; }), function (a, b) { return b.comMes - a.comMes || b.maos - a.maos; }, function (r) {
      return cartao(r, d ? r.comMes : null, 'propostas aceitas no m\u00eas', d ? plural(r.comHoje, 'hoje', 'hoje') : '', [
        { n: r.forMes, t: r.forMes === 1 ? 'cess\u00e3o' : 'cess\u00f5es' },
        { n: r.maos, t: 'em m\u00e3os', sempre: true },
        { n: r.late, t: r.late === 1 ? 'atrasada' : 'atrasadas', alerta: r.late > 0 }
      ]);
    });
    secao('triagem', 'Triagem', [
      { t: d ? plural(d.tot.triHoje, 'triagem hoje', 'triagens hoje') : 'lendo o log\u2026' },
      { t: d ? plural(d.tot.triMes, 'no m\u00eas', 'no m\u00eas') : '' },
      { t: plural(tri.filter(function (it) { return it.fila; }).length, 'na fila', 'na fila') }
    ].filter(function (x) { return x.t; }), function (a, b) { return b.triHoje - a.triHoje || b.triMes - a.triMes; }, function (r) {
      return cartao(r, d ? r.triHoje : null, 'triagens hoje', d ? plural(r.triMes, 'no m\u00eas', 'no m\u00eas') : '', [
        { n: r.maos, t: 'em m\u00e3os', sempre: true },
        { n: r.late, t: r.late === 1 ? 'atrasada' : 'atrasadas', alerta: r.late > 0 }
      ]);
    });
    secao('juridico', 'Jur\u00eddico', [
      { t: d ? plural(somaG('juridico', 'hoje'), 'tarefa conclu\u00edda hoje', 'tarefas conclu\u00eddas hoje') : 'lendo o log\u2026' },
      { t: plural(somaG('juridico', 'late'), 'atrasada', 'atrasadas'), alerta: somaG('juridico', 'late') > 0 }
    ].filter(function (x) { return x.t; }), function (a, b) { return b.late - a.late || b.hoje - a.hoje; }, function (r) {
      return cartao(r, d ? r.hoje : null, 'tarefas conclu\u00eddas hoje', '', [
        { n: r.maos, t: 'em m\u00e3os', sempre: true },
        { n: r.late, t: r.late === 1 ? 'atrasada' : 'atrasadas', alerta: r.late > 0 }
      ]);
    });

    // triagens por dia (cart\u00e3o largo)
    if (d && (!stInst.time || stInst.time === 'triagem')) {
      var b4 = vizBox('Triagens por dia', fmtN(d.tot.triMes) + ' no m\u00eas; hoje em destaque');
      b4.className = 'lcbk-viz lcbk-viz-larga';
      colunasDia(b4, d.dias, 'tri', COR_TIME.triagem);
      frag.appendChild(b4);
    }
    frag.appendChild(el('p', 'lcbk-nota', 'Mesmas regras da Torre: triagem = T01 do Pai finalizada; proposta aceita = negocia\u00e7\u00e3o entrou na T07; cess\u00e3o protocolada = T24 finalizada. O vendedor \u00e9 o solicitante da negocia\u00e7\u00e3o (quando \u00e9 a SDR, quem fez a T01-Negociar Compra).'));
    p.replaceChildren(frag);
  }

  function renderInst() {
    if (!uiI.board) return;
    var lidos = itensDaLista();
    var completo = completoServe();
    if (!completo && LC.completo && LC.completo.base === LC.base && !LC.carregando) setTimeout(agendarAuto, 0);   // esteira pede outra carga
    var layoutId = layoutInstAtivo();
    var L = LAYOUTS_INST[layoutId];
    // O resumo por pessoa e o filtro "Com quem" seguem a esteira escolhida: na Esteira jur\u00eddica,
    // s\u00f3 entram processos em etapas do jur\u00eddico (a menos que "Mostrar outras \u00e1reas" esteja marcado).
    var foraDaArea = 0, foraDoTime = 0;
    var buscando = !!stInst.busca;
    if ((layoutId === 'comercial' || layoutId === 'juridico') && lidos.some(function (it) { return it.tipo === 'filho'; })) {
      var velhoF = !FORM.em || FORM.base !== LC.base || Date.now() - FORM.em.getTime() > 10 * 60000;
      if (velhoF && !FORM.carregando && listaPronta() && !(FORM.erro && FORM.base === LC.base)) setTimeout(carregarFormularios, 0);
      lidos.forEach(enriquecer);
    }
    if (buscando && LB.q === stInst.busca && LB.itens.length) {       // junta o que o Zeev achou
      var ja = {};
      lidos.forEach(function (it) { ja[it.num] = 1; });
      LB.itens.forEach(function (it) { if (!ja[it.num]) lidos.push(it); });
    }
    if (stInst.comigo && MEU.nums) lidos = lidos.filter(function (it) { return MEU.nums[it.num]; });
    var semRecorte = buscando || stInst.comigo;                        // busca e "Comigo" ignoram esteira/time/pessoa
    var todos = lidos.filter(function (it) {
      if (semRecorte) return true;
      if (L.esteira && !stInst.outras && L.place(it) === 'outros') { foraDaArea++; return false; }
      if (stInst.time && timeDe(it) !== stInst.time && !(timeDe(it) === 'filho' && stInst.time !== 'triagem')) {
        foraDoTime++;
        return false;
      }
      return true;
    });
    var chaveAtor = function (it) { return it.ativo && it.quem ? (it.fila ? rotuloFila(it) : it.quem) : ''; };
    var atores = {};
    todos.forEach(function (it) {
      var k = chaveAtor(it);
      if (!k) return;
      var a = atores[k] || (atores[k] = { k: k, total: 0, atrasados: 0, times: {}, fila: !!it.fila,
                                          membros: it.fila ? membrosFila(it) : '' });
      a.total++;
      if (it.late) a.atrasados++;
      var tm = timeDe(it);
      a.times[tm] = (a.times[tm] || 0) + 1;
    });
    if (stInst.ator && !atores[stInst.ator]) stInst.ator = '';
    var itens = stInst.ator && !semRecorte ? todos.filter(function (it) { return chaveAtor(it) === stInst.ator; }) : todos;
    if (layoutId === 'rejeitados') {                                  // colunas = motivos presentes na lista
      var cont = {}, nomeM = {};
      lidos.forEach(function (it) {
        if (it.ativo || it.tipo === 'filho' || !rejeitadoTriagem(it)) return;
        var m = motivoRejeicao(it), k = slug(m);
        cont[k] = (cont[k] || 0) + 1; nomeM[k] = nomeM[k] || m;
      });
      REJ.cols = Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a]; })
        .map(function (k) { return { id: k, name: nomeM[k], alert: true, encerrada: true }; });
    }
    var cols = L.cols(), buckets = {}, q = stInst.busca.toLowerCase(), ocultos = 0, achados = 0;
    // filtro de etapa: op\u00e7\u00f5es = colunas da esteira atual
    if (uiI.fEtapa) {
      var opE = [['', 'Etapa: todas']].concat(cols.filter(function (c) { return c.id !== 'outros'; }).map(function (c) { return [c.id, c.name]; }));
      var chaveE = opE.map(function (o) { return o[0]; }).join('|');
      if (uiI.fEtapa._chave !== chaveE) {
        uiI.fEtapa._chave = chaveE;
        uiI.fEtapa.replaceChildren();
        opE.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; uiI.fEtapa.appendChild(op); });
      }
      if (stInst.etapa && chaveE.split('|').indexOf(stInst.etapa) === -1) stInst.etapa = '';
      uiI.fEtapa.value = stInst.etapa;
    }
    cols.forEach(function (c) { buckets[c.id] = []; });
    itens.forEach(function (it) {
      var col = L.place(it);
      if (!buckets[col]) return;
      var cpfI = (it.info || {}).cpf ? it.info.cpf + ' ' + it.info.cpf.replace(/\D/g, '') : '';
      var texto = [it.numero, it.titulo, it.processo, it.atividade, it.quem, (it.info || {}).procNum, cpfI].join(' ').toLowerCase();
      var qd = q.replace(/\D/g, '');
      if (q && !it._busca && texto.indexOf(q) === -1 && !(qd.length >= 4 && texto.replace(/\D/g, ' ').indexOf(qd) !== -1)) {
        ocultos++;
        return;
      }
      if (q) achados++;
      buckets[col].push(it);
    });
    // Se TODOS os carregados ca\u00edram numa \u00fanica coluna, o total do Zeev PODE ser o total dela,
    // mas s\u00f3 se a lista estiver filtrada por essa etapa. O script n\u00e3o tem como saber isso:
    // a pessoa confirma com um clique, e a confirma\u00e7\u00e3o vale s\u00f3 para esse total e essa coluna.
    var totalLista = totalZeev();
    var comItens = cols.filter(function (c) { return buckets[c.id].length; });
    var candidata = (!completo && totalLista && totalLista > todos.length && !q && !stInst.ator && !foraDaArea &&
                     comItens.length === 1 && buckets[comItens[0].id].length === lidos.length) ? comItens[0].id : '';
    var chaveTotal = candidata + '|' + totalLista + '|' + location.pathname;
    var colTotal = candidata && stInst.totalConfirmado === chaveTotal ? candidata : '';

    var frag = document.createDocumentFragment();
    cols.forEach(function (c) {
      var list = buckets[c.id];
      if (stInst.etapa && c.id !== stInst.etapa) return;               // filtro de etapa
      if (c.opcional && !list.length) return;
      if (semRecorte && !list.length) return;                          // na busca e no "Comigo", s\u00f3 colunas com cards
      var sec = el('section', 'lcbk-col' + (c.alert ? ' is-alert' : '') + (c.ok ? ' is-ok' : ''));
      var head = el('header', 'lcbk-head');
      var h = el('div');
      h.appendChild(el('h3', null, c.name));
      var n = list.length;
      var somaFace = list.reduce(function (a, it) { var f = it.info || {}; return a + (f.faceN || valorNum(f.face)); }, 0);
      var somaProp = list.reduce(function (a, it) { return a + ((it.info || {}).propN || 0); }, 0);
      if ((somaFace || somaProp) && !c.dica) c.dica = '';
      if (c.id === colTotal) {
        n = totalLista;
        var sm = el('small', null, 'Total da lista do Zeev, confirmado por voc\u00ea (' + list.length + ' nesta p\u00e1gina) ');
        var desf = el('button', 'lcbk-linkbtn', 'desfazer');
        desf.type = 'button';
        desf.addEventListener('click', function () { stInst.totalConfirmado = ''; renderInst(); });
        sm.appendChild(desf);
        h.appendChild(sm);
      } else if (c.id === candidata) {
        var sm2 = el('small', null, list.length + ' nesta p\u00e1gina. Lista filtrada s\u00f3 por esta etapa? ');
        var usar = el('button', 'lcbk-linkbtn', 'Usar total do Zeev (' + fmtN(totalLista) + ')');
        usar.type = 'button';
        usar.addEventListener('click', function () { stInst.totalConfirmado = chaveTotal; renderInst(); });
        sm2.appendChild(usar);
        h.appendChild(sm2);
      } else if (c.dica != null) {
        if (c.dica) h.appendChild(el('small', null, c.dica));
        if (somaFace) h.appendChild(el('small', 'lcbk-soma', 'Valor de Face: ' + moedaBR(somaFace)));
        if (somaProp) h.appendChild(el('small', 'lcbk-soma is-prop', 'Valor de Desembolso: ' + moedaBR(somaProp)));
      }
      head.appendChild(h);
      head.appendChild(el('span', 'lcbk-count', fmtN(n)));
      sec.appendChild(head);
      var body = el('div', 'lcbk-list');
      if (!list.length) body.appendChild(el('p', 'lcbk-empty', q ? 'Nada com esse filtro' : 'Nada aqui'));
      list.sort(function (a, b) {
        if (c.encerrada) return (b.fimEm ? b.fimEm.getTime() : 0) - (a.fimEm ? a.fimEm.getTime() : 0);
        if (a.late !== b.late) return a.late ? -1 : 1;
        var da = a.due && a.due.date ? a.due.date.getTime() : 8.64e15;
        var db = b.due && b.due.date ? b.due.date.getTime() : 8.64e15;
        return da - db;
      });
      var limI = (stInst.lim[c.id] || CFG.lista.cardsPorColuna);
      list.slice(0, limI).forEach(function (it) { it._col = c; body.appendChild(cardInst(it, layoutId)); });
      if (list.length > limI) body.appendChild(botaoMais(list.length - limI, function () {
        stInst.lim[c.id] = limI + CFG.lista.cardsPorColuna; renderInst();
      }));
      sec.appendChild(body);
      frag.appendChild(sec);
    });
    uiI.board.replaceChildren(frag);
    if (buscando && !achados) {
      uiI.board.appendChild(el('p', 'lcbk-busca-vazia', LB.carregando && LB.q === stInst.busca
        ? 'Procurando "' + stInst.busca + '" em todas as solicita\u00e7\u00f5es que voc\u00ea pode ver no Zeev\u2026'
        : 'Nada encontrado para "' + stInst.busca + '". Confira a grafia, ou procure pelo n\u00famero da solicita\u00e7\u00e3o, CPF ou n\u00famero do processo.'));
    } else if (stInst.comigo && MEU.carregando && !MEU.nums) {
      uiI.board.appendChild(el('p', 'lcbk-busca-vazia', 'Buscando as suas tarefas abertas\u2026'));
    } else if (stInst.comigo && !uiI.board.children.length) {
      uiI.board.appendChild(el('p', 'lcbk-busca-vazia', MEU.erro ? 'N\u00e3o foi poss\u00edvel ler as suas tarefas abertas.'
        : 'Nenhuma solicita\u00e7\u00e3o desta lista est\u00e1 com voc\u00ea agora.'));
    }
    uiI.board.style.setProperty('--lcbk-cols', String(uiI.board.children.length || 1));
    uiI.board.classList.add('lcbk-largo');
    uiI.btnComigo.classList.toggle('is-on', stInst.comigo);
    uiI.btnComigo.setAttribute('aria-pressed', stInst.comigo ? 'true' : 'false');
    uiI.btnComigo.textContent = stInst.comigo && !MEU.nums ? 'Comigo\u2026' : 'Comigo';

    // Filtro e resumo por ator (quem est\u00e1 com a atividade atual)
    var lista = Object.keys(atores).map(function (k) { return atores[k]; })
      .sort(function (a, b) { return b.total - a.total || a.k.localeCompare(b.k); });
    var ORDEM_TIME = { triagem: 0, comercial: 1, juridico: 2, '': 3 };
    lista.forEach(function (a) {                 // time principal de cada pessoa
      var melhor = '', max = 0;
      Object.keys(a.times).forEach(function (t) { if (a.times[t] > max) { max = a.times[t]; melhor = t; } });
      a.time = NOMES_TIME[melhor] ? melhor : '';
    });
    uiI.fAtor.replaceChildren(el('option', null, 'Com quem: todos'));
    uiI.fAtor.options[0].value = '';
    ['triagem', 'comercial', 'juridico', '', 'fila'].forEach(function (t) {
      var doTime = lista.filter(function (a) { return t === 'fila' ? a.fila : (!a.fila && a.time === t); });
      if (!doTime.length) return;
      var g = el('optgroup');
      g.label = t === 'fila' ? 'Na fila (ningu\u00e9m assumiu)' : (NOMES_TIME[t] || 'Outros');
      doTime.forEach(function (a) {
        var o = el('option', null, a.k + ' (' + a.total + ')');
        o.value = a.k;
        g.appendChild(o);
      });
      uiI.fAtor.appendChild(g);
    });
    uiI.fAtor.value = stInst.ator;
    uiI.fTime.value = stInst.time;
    var box = el('div', 'lcbk-resumo');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Quantos est\u00e3o com cada pessoa');
    lista.slice().sort(function (a, b) {
      return (a.fila - b.fila) || ORDEM_TIME[a.time] - ORDEM_TIME[b.time] || b.total - a.total;
    }).slice(0, 60).forEach(function (a) {
      var b = el('button', 'lcbk-pessoa' + (a.fila ? ' is-fila' : '') + (stInst.ator === a.k ? ' is-on' : ''));
      if (a.fila) b.title = 'Ningu\u00e9m assumiu. Pode ser assumida por: ' + a.membros;
      b.type = 'button';
      b.setAttribute('aria-pressed', stInst.ator === a.k ? 'true' : 'false');
      b.appendChild(el('span', 'lcbk-time', a.fila ? 'Sem dono' : (NOMES_TIME[a.time] || 'Outros')));
      b.appendChild(el('strong', null, a.k));
      b.appendChild(el('span', null, a.total + (a.total === 1 ? ' processo' : ' processos')));
      if (a.atrasados) b.appendChild(el('span', 'is-stuck', a.atrasados + (a.atrasados === 1 ? ' atrasado' : ' atrasados')));
      b.addEventListener('click', function () { stInst.ator = stInst.ator === a.k ? '' : a.k; renderInst(); });
      box.appendChild(b);
    });
    uiI.resumo.replaceChildren(box);
    var verResumo = ls('lcbKanbanResumo') !== 'off';
    uiI.resumo.style.display = verResumo && stInst.view === 'kanban' && lista.length && !(EH_GESTOR && stInst.painel) ? '' : 'none';
    if (uiI.btnResumo) {
      uiI.btnResumo.style.display = stInst.view === 'kanban' && lista.length && !(EH_GESTOR && stInst.painel) ? '' : 'none';
      uiI.btnResumo.textContent = verResumo ? 'Ocultar pessoas' : 'Mostrar pessoas';
      uiI.btnResumo.setAttribute('aria-pressed', verResumo ? 'true' : 'false');
    }
    renderPainel(lidos, completo, totalZeev());
    if (uiI.btnPainel) {
      uiI.btnPainel.style.display = EH_GESTOR && stInst.view === 'kanban' ? '' : 'none';
      uiI.btnPainel.textContent = stInst.painel ? 'Ocultar painel do gestor' : 'Mostrar painel do gestor';
    }

    var total = totalZeev();
    var parcial = total && total > lidos.length && !(completo && !LC.completo.limitado);
    var vazia = L.esteira && !todos.length && foraDaArea && !foraDoTime;
    var soTime = !todos.length && foraDoTime && stInst.time;
    // esteira comercial numa lista sem nenhuma negocia\u00e7\u00e3o (Filho): explica onde est\u00e1 o funil
    var semNeg = layoutId === 'comercial' && !buscando && lidos.length >= 30 &&
      !lidos.some(function (it) { return it.tipo === 'filho'; });
    uiI.aviso.textContent = soTime
      ? 'O filtro "Time: ' + (NOMES_TIME[stInst.time] || stInst.time) + '" est\u00e1 escondendo os ' + fmtN(foraDoTime) +
        ' processos desta esteira. Troque para "Time: todos".'
      : semNeg
      ? 'Esta lista n\u00e3o tem nenhuma negocia\u00e7\u00e3o (fluxos Filho): por isso Fechado comercialmente, Fechados e Perdidas aparecem zerados. ' +
        (EH_GESTOR || CFG.pathGestor.test(location.pathname)
          ? 'Confira o filtro do Zeev: ele pode estar limitando a lista a um fluxo s\u00f3.'
          : 'Acompanhar solicita\u00e7\u00f5es mostra s\u00f3 as solicita\u00e7\u00f5es ligadas a voc\u00ea. Para ver o funil comercial de todos, use Monitorar > Solicita\u00e7\u00f5es.')
      : vazia
      ? 'Nenhum dos ' + lidos.length + ' processos desta p\u00e1gina est\u00e1 numa etapa da ' + L.nome + '. ' +
        (parcial ? 'A lista tem ' + fmtN(total) + ' processos e o Zeev s\u00f3 carregou esta p\u00e1gina: use o Filtrar do Zeev (por exemplo, fluxo Filho e status Em andamento) para trazer os processos desta esteira.' : 'Marque "Mostrar outras \u00e1reas" para ver onde eles est\u00e3o.')
      : parcial ? 'Mostrando ' + lidos.length + ' de ' + fmtN(total) +
        '. As colunas e a contagem por pessoa consideram s\u00f3 os carregados. Para o n\u00famero exato de uma pessoa, use Filtrar do Zeev pelo respons\u00e1vel: o total "inst\u00e2ncia(s) encontrada(s)" passa a ser o dela.' : '';
    if (completo && LC.completo.limitado && !vazia) {
      uiI.aviso.textContent = 'Carregados os primeiros ' + fmtN(lidos.length) + ' de ' + fmtN(total) +
        ' (limite de ' + fmtN(CFG.lista.maxItens) + ' para n\u00e3o pesar no Zeev). Filtre a lista para ter os n\u00fameros completos.';
    }
    if (LC.erro) uiI.aviso.textContent = 'Lista completa: ' + LC.erro + '. Mostrando s\u00f3 a p\u00e1gina atual.';
    uiI.aviso.style.display = (soTime || semNeg || vazia || (parcial && !colTotal) || LC.erro || (completo && LC.completo.limitado)) &&
      stInst.view === 'kanban' ? '' : 'none';
    // bot\u00e3o de carregar tudo
    var falta = !completo && total && total > lidos.length && LC.url;
    uiI.btnTudo.style.display = (falta || LC.carregando) && stInst.view === 'kanban' ? '' : 'none';
    uiI.btnTudo.textContent = LC.carregando ? LC.prog + ' (cancelar)' :
      'Carregar todas (' + fmtN(Math.min(total || 0, CFG.lista.maxItens)) + ')';
    if (LC.carregando) uiI.btnTudo.textContent = LC.prog + ' Cancelar';
    uiI.btnAtual.style.display = completo && !LC.carregando && stInst.view === 'kanban' ? '' : 'none';
    var origem = completo
      ? (LC.completo.funil ? 'Funil ' + (LC.completo.funil === 'comercial' ? 'comercial' : 'jur\u00eddico') + ': ' + fmtN(lidos.length) + ' carregadas (s\u00f3 o que a esteira usa)'
         : LC.completo.limitado ? fmtN(lidos.length) + ' de ' + fmtN(total) + ' carregados'
                              : 'Todas as ' + fmtN(lidos.length) + ' carregadas') +
        ' \u00e0s ' + LC.completo.em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : (total ? lidos.length + ' de ' + fmtN(total) : lidos.length + ' nesta p\u00e1gina');
    uiI.status.textContent = origem +
      (stInst.ator ? ' | filtrando: ' + stInst.ator + ' (' + itens.length + ')' : '') +
      (foraDaArea ? ' | ' + foraDaArea + ' em outras \u00e1reas' : '') +
      (foraDoTime ? ' | ' + foraDoTime + ' de outros times' : '') +
      (buscando ? ' | busca: ' + achados + ' encontrado(s)' + (LB.carregando ? ', procurando no Zeev\u2026' : '') : '') +
      (layoutId === 'comercial' ? (FORM.carregando ? ' | lendo valores das negocia\u00e7\u00f5es\u2026' : FORM.erro ? ' | valores indispon\u00edveis (' + FORM.erro + ')' :
        FORM.incompleto ? ' | valores: export cortado em 1.000 linhas' : '') : '') +
      (LC.completo && LC.completo.daCopia && LC.carregando ? ' | c\u00f3pia salva, atualizando\u2026' : '') +
      (stInst.comigo ? ' | s\u00f3 comigo' + (MEU.erro ? ' (n\u00e3o foi poss\u00edvel ler suas tarefas)' : '') : '') + ' | Kanban ' + VERSAO +
      (ocultos ? ' | ' + ocultos + ' oculto(s) pela busca' : '');
    document.documentElement.classList.toggle('lcbk-on', stInst.view === 'kanban');
    $$('.lcbk-seg', uiI.bar).forEach(function (b) {
      var on = stInst.view === b.dataset.value;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    uiI.tools.style.display = stInst.view === 'kanban' ? '' : 'none';
    uiI.layout.value = layoutId;
    uiI.outras.parentNode.style.display = L.esteira ? '' : 'none';
    uiI.outras.checked = stInst.outras;
  }

  function shellInst(container) {
    css();
    container.classList.add('lcbk-oculto');
    uiI.bar = el('div', 'lcbk-bar');
    var views = el('div', 'lcbk-group');
    views.setAttribute('role', 'group');
    views.setAttribute('aria-label', 'Visualiza\u00e7\u00e3o');
    [['Lista', 'lista'], ['Kanban', 'kanban']].forEach(function (v) {
      var b = el('button', 'lcbk-seg', v[0]);
      b.type = 'button';
      b.dataset.value = v[1];
      b.addEventListener('click', function () {
        stInst.view = v[1];
        ls(CFG.keys.viewInst, v[1]);
        renderInst();
      });
      views.appendChild(b);
    });
    uiI.bar.appendChild(views);
    uiI.tools = el('div', 'lcbk-tools');
    uiI.layout = el('select', 'lcbk-select');
    uiI.layout.setAttribute('aria-label', 'Disposi\u00e7\u00e3o do Kanban');
    Object.keys(LAYOUTS_INST).forEach(function (k) {
      var o = el('option', null, LAYOUTS_INST[k].nome);
      o.value = k;
      uiI.layout.appendChild(o);
    });
    uiI.layout.addEventListener('change', function () {
      stInst.layout = uiI.layout.value;
      stInst.etapa = '';
      stInst.time = ''; ls('lcbKanbanTime', '');
      ls(CFG.keys.layoutInst, stInst.layout);
      renderInst();
    });
    uiI.tools.appendChild(uiI.layout);
    uiI.fEtapa = el('select', 'lcbk-select');
    uiI.fEtapa.setAttribute('aria-label', 'Mostrar s\u00f3 uma etapa');
    uiI.fEtapa.addEventListener('change', function () { stInst.etapa = uiI.fEtapa.value; renderInst(); });
    uiI.tools.appendChild(uiI.fEtapa);
    uiI.fAtor = el('select', 'lcbk-select');
    uiI.fAtor.setAttribute('aria-label', 'Filtrar por quem est\u00e1 com a atividade');
    uiI.fAtor.addEventListener('change', function () { stInst.ator = uiI.fAtor.value; renderInst(); });
    uiI.fTime = el('select', 'lcbk-select');
    uiI.fTime.setAttribute('aria-label', 'Filtrar por time');
    [['', 'Time: todos'], ['triagem', 'Triagem'], ['comercial', 'Comercial'], ['juridico', 'Jur\u00eddico']].forEach(function (t) {
      var o = el('option', null, t[1]); o.value = t[0]; uiI.fTime.appendChild(o);
    });
    uiI.fTime.addEventListener('change', function () {
      stInst.time = uiI.fTime.value;
      stInst.ator = '';
      ls('lcbKanbanTime', stInst.time);
      renderInst();
    });
    uiI.tools.appendChild(uiI.fTime);
    uiI.tools.appendChild(uiI.fAtor);
    uiI.btnComigo = el('button', 'lcbk-btn lcbk-comigo', 'Comigo');
    uiI.btnComigo.type = 'button';
    uiI.btnComigo.title = 'S\u00f3 as solicita\u00e7\u00f5es em que voc\u00ea tem tarefa aberta agora';
    uiI.btnComigo.addEventListener('click', function () {
      stInst.comigo = !stInst.comigo;
      if (stInst.comigo && (!MEU.nums || Date.now() - MEU.em.getTime() > 120000)) carregarMinhas();
      renderInst();
    });
    uiI.tools.appendChild(uiI.btnComigo);
    uiI.btnResumo = el('button', 'lcbk-btn', 'Ocultar pessoas');
    uiI.btnResumo.type = 'button';
    uiI.btnResumo.title = 'Mostrar ou ocultar a faixa com o resumo por pessoa';
    uiI.btnResumo.addEventListener('click', function () {
      ls('lcbKanbanResumo', ls('lcbKanbanResumo') === 'off' ? 'on' : 'off');
      renderInst();
    });
    uiI.tools.appendChild(uiI.btnResumo);
    var lbl = el('label', 'lcbk-check');
    uiI.outras = el('input');
    uiI.outras.type = 'checkbox';
    uiI.outras.addEventListener('change', function () {
      stInst.outras = uiI.outras.checked;
      ls('lcbKanbanOutras', stInst.outras ? '1' : '0');
      renderInst();
    });
    lbl.appendChild(uiI.outras);
    lbl.appendChild(document.createTextNode(' Mostrar outras \u00e1reas'));
    uiI.tools.appendChild(lbl);
    var busca = el('input', 'lcbk-search');
    busca.type = 'search';
    busca.placeholder = 'Buscar n\u00ba, nome, CPF, processo ou atividade';
    busca.setAttribute('aria-label', 'Buscar no Kanban');
    var tb;
    busca.addEventListener('input', function () {
      clearTimeout(tb);
      tb = setTimeout(function () { stInst.busca = clean(busca.value); buscarNoZeev(stInst.busca); renderInst(); }, 150);
    });
    uiI.tools.appendChild(busca);
    uiI.btnTudo = el('button', 'lcbk-btn');
    uiI.btnTudo.type = 'button';
    uiI.btnTudo.addEventListener('click', function () {
      if (LC.carregando) { LC.cancelar = true; return; }
      LC.erro = '';
      carregarTudo();
    });
    uiI.tools.appendChild(uiI.btnTudo);
    uiI.btnPainel = el('button', 'lcbk-btn');
    uiI.btnPainel.type = 'button';
    uiI.btnPainel.addEventListener('click', function () {
      stInst.painel = !stInst.painel; ls('lcbKanbanPainel', stInst.painel ? '1' : '0'); renderInst();
    });
    uiI.tools.appendChild(uiI.btnPainel);
    uiI.btnAtual = el('button', 'lcbk-btn', 'Atualizar');
    uiI.btnAtual.type = 'button';
    uiI.btnAtual.title = 'Buscar de novo todas as p\u00e1ginas';
    uiI.btnAtual.addEventListener('click', function () { LC.completo = null; LC.erro = ''; carregarTudo(); });
    uiI.tools.appendChild(uiI.btnAtual);
    uiI.status = el('span', 'lcbk-status');
    uiI.status.setAttribute('aria-live', 'polite');
    uiI.tools.appendChild(uiI.status);
    uiI.bar.appendChild(uiI.tools);
    uiI.aviso = el('p', 'lcbk-aviso');
    uiI.aviso.setAttribute('role', 'status');
    uiI.resumo = el('div');
    uiI.painel = el('section', 'lcbk-painel');
    uiI.painel.setAttribute('aria-label', 'Vis\u00e3o do gestor');
    uiI.board = el('div', 'lcbk-board');
    container.parentNode.insertBefore(uiI.bar, container);
    container.parentNode.insertBefore(uiI.painel, container);
    container.parentNode.insertBefore(uiI.aviso, container);
    container.parentNode.insertBefore(uiI.resumo, container);
    container.parentNode.insertBefore(uiI.board, container.nextSibling);
  }

  var timerI;
  function vigiarConsultas() {
    var ver = function (u) { if (MODO === 'tarefas') registrarUrlTarefas(u); else registrarUrl(u); };
    try {
      performance.getEntriesByType('resource').forEach(function (e) { ver(e.name); });
      new PerformanceObserver(function (l) {
        l.getEntries().forEach(function (e) { ver(e.name); });
      }).observe({ type: 'resource', buffered: true });
    } catch (e) { /* navegador sem PerformanceObserver: fica s\u00f3 com a p\u00e1gina atual */ }
  }

  // Cabe\u00e7alhos das consultas \u00e0 API interna: o Zeev exige o token antifalsifica\u00e7\u00e3o da pr\u00f3pria
  // p\u00e1gina (campo __RequestVerificationToken). O valor nunca \u00e9 exibido nem guardado.
  function cabecalhosApi() {
    var h = { Accept: 'application/json' };
    var tk = document.querySelector('input[name="__RequestVerificationToken"]');
    if (tk && tk.value) h['x-sml-antiforgerytoken'] = tk.value;
    return h;
  }
  function getJson(url) {
    return fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
                        headers: cabecalhosApi() })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        if (!/json/i.test(r.headers.get('content-type') || '')) throw new Error('resposta n\u00e3o veio em JSON');
        return r.json();
      });
  }

  // \u2550\u2550\u2550 LISTA COMPLETA DE TAREFAS (Executar tarefas) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  var PADRAO_TAREFAS = /\/api\/internal\/bpms\/[\d.]+\/assignments\?/i;
  var LT = { url: '', base: '', completo: null, carregando: false, cancelar: false, prog: '', erro: '', cont: null };
  function baseTarefas(u) {
    try {
      var x = new URL(u, location.origin);
      x.searchParams.delete('pageNumber'); x.searchParams.delete('recordsPerPage');
      return x.href;
    } catch (e) { return ''; }
  }
  var tCont, tAutoT;
  function registrarUrlTarefas(u) {
    try {
      var x = new URL(u, location.origin);
      if (x.origin !== location.origin || !PADRAO_TAREFAS.test(x.pathname + x.search)) return;
      if (ehNossa(x.href)) return;                              // consultas do pr\u00f3prio Kanban
      var b = baseTarefas(x.href);
      if (LT.carregando && b === LT.base) return;              // nossas pr\u00f3prias consultas
      if (LT.carregando) LT.cancelar = true;
      LT.url = x.href;
      if (LT.base !== b) { LT.completo = null; LT.erro = ''; LT.cont = null; }
      else if (LT.completo && !LT.carregando && velho(LT.completo)) setTimeout(carregarTarefas, 300);
      LT.base = b;
      clearTimeout(tCont); tCont = setTimeout(buscarContagem, 300);
      clearTimeout(tAutoT); tAutoT = setTimeout(autoTarefas, 900);
    } catch (e) { /* ignora */ }
  }
  function buscarContagem() {
    try {
      var x = new URL(LT.base);
      x.pathname = x.pathname.replace(/\/assignments\/?$/, '/assignments/count-filtered');
      var base = LT.base;
      getJson(x.href).then(function (j) {
        var sx = j && j.success;
        if (!sx || typeof sx.filtered !== 'number') return;
        LT.cont = { base: base, filtered: sx.filtered, ontime: Math.min(sx.ontime || 0, sx.filtered), em: new Date() };
        schedule();
      }).catch(function () { /* sem contagem: fica com o texto da p\u00e1gina */ });
    } catch (e) { /* ignora */ }
  }
  function autoTarefas() {
    var tot = LT.cont ? LT.cont.filtered : totalZeev();
    if (!LT.completo && !LT.carregando && !LT.erro && LT.url && tot && tot <= CFG.lista.autoAte) carregarTarefas();
  }
  function nomeDoUsuario(h) {
    if (!h) return '';
    var d = new DOMParser().parseFromString(String(h), 'text/html').body;
    var w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { var t = clean(n.nodeValue); if (t.length > 3) return semDoc(t); }
    return '';
  }
  // Item da API de tarefas -> card. O campo "r" (resumo, com CPF) N\u00c3O \u00e9 lido.
  function daApiTarefa(x) {
    var now = new Date();
    var titulo = semDoc(textoDeHtml(x.t));
    var processo = semDoc(textoDeHtml(x.fn));
    var due = parseDue({ textContent: textoDeHtml(x.dte), querySelector: function () { return null; } });
    var late = /danger/i.test(String(x.es || '')) || !!(due && due.date && due.date < now);
    var tipo = tipoDe(processo), cl = classificar(tipo, titulo);
    return {
      kind: 'tarefa', tr: null, taskCell: null, link: null, href: x.lk ? sameOrigin(x.lk) : null,
      num: digits(x.cfe), numero: '#' + digits(x.cfe), titulo: titulo, processo: processo, atividade: titulo,
      quem: nomeDoUsuario(x.u), due: due, late: late, info: infoResumo(htmlParaRaiz(x.r)),
      today: !late && !!(due && due.date && due.date.toDateString() === now.toDateString()),
      stage: cl.etapa, area: cl.area, tipo: tipo
    };
  }
  function carregarTarefas() {
    if (LT.carregando || !LT.url) return;
    var u = new URL(LT.url);
    var base = baseTarefas(u.href);
    var total = LT.cont ? LT.cont.filtered : totalZeev();
    var rpp = CFG.lista.tamanhoPagina, p = 1, itens = [], vistos = {};
    LT.carregando = true; LT.cancelar = false; LT.erro = ''; LT.base = base; LT.parcial = itens;
    function fim(msg) {
      LT.carregando = false; LT.prog = ''; LT.parcial = null;
      if (LT.cancelar) setTimeout(autoTarefas, 50);
      if (msg) { LT.erro = msg; LT.completo = null; }
      else if (!LT.cancelar) {
        LT.completo = { base: base, itens: itens, em: new Date(),
                        limitado: !!(total && total > itens.length && itens.length >= CFG.lista.maxItens) };
      }
      render();
    }
    function proxima() {
      if (LT.cancelar) return fim('');
      LT.prog = 'Carregando ' + fmtN(itens.length) + (total ? ' de ' + fmtN(total) : '') + '\u2026';
      render();
      u.searchParams.set('pageNumber', String(p));
      u.searchParams.set('recordsPerPage', String(rpp));
      getJson(nossa(u.href)).then(function (j) {
        var sx = j && j.success, lote = (sx && sx.itens) || [];
        if (p === 1 && sx && sx.hasmoreitens && lote.length && lote.length < rpp) rpp = lote.length;
        lote.forEach(function (x) {
          var it = daApiTarefa(x);
          var k = it.num + '|' + it.titulo;
          if (it.num && !vistos[k]) { vistos[k] = 1; itens.push(it); }
        });
        if (!sx || !sx.hasmoreitens || !lote.length || itens.length >= CFG.lista.maxItens) return fim('');
        p++;
        setTimeout(proxima, 120);
      }).catch(function (e) { fim('n\u00e3o foi poss\u00edvel carregar a lista completa (' + (e && e.message) + ')'); });
    }
    proxima();
  }

  var prodIniciada = false;
  function iniciarProducao() {
    if (prodIniciada || !EH_GESTOR) return;
    prodIniciada = true;
    setTimeout(carregarProducao, 1500);
    setInterval(function () {
      if (document.visibilityState === 'visible' && stInst.painel) carregarProducao();
    }, CFG.producao.atualizarMin * 60000);
  }

  function abrirUltimaCopia() {
    var ult = null;
    try { ult = JSON.parse(sessionStorage.getItem('lcbkUlt:' + location.pathname) || 'null'); } catch (e) { /* ignora */ }
    if (!ult || !ult.base || LC.url) return;
    LC.url = ult.base; LC.base = ult.base;
    restaurarCache(ult.base, ult.funil);
  }
  function bootInst(tries) {
    if (tries === 0) abrirUltimaCopia();
    if (tries === 0) vigiarAtualizacao();
    if (tries === 0) iniciarProducao();
    if (tries === 0) vigiarConsultas();
    var t = tabelaInst();
    if (!t) {
      if (tries < 40) setTimeout(function () { bootInst(tries + 1); }, 250);
      return;
    }
    var container = t.closest('.crud-list-table') || t;
    var root = document.querySelector(CFG.sel.root) || container.parentNode;
    shellInst(container);
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var x = recs[i].target;
        if (!uiI.board.contains(x) && !uiI.bar.contains(x) && !uiI.resumo.contains(x) && !uiI.aviso.contains(x) &&
            !uiI.painel.contains(x)) {
          clearTimeout(timerI);
          timerI = setTimeout(renderInst, 150);
          return;
        }
      }
    }).observe(root, { childList: true, subtree: true, characterData: true });
    renderInst();
  }

  var iniciar = function () { if (MODO === 'tarefas') boot(0); else bootInst(0); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
