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

  // \u2550\u2550\u2550 CONFIGURA\u00c7\u00c3O \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  var CFG = {
    path: /^\/my\/tasks\/?$/,          // Minhas tarefas (visual novo)
    // Acompanhar solicita\u00e7\u00f5es / Monitorar: qualquer p\u00e1gina /my/... ou /report/... que tenha a
    // tabela de inst\u00e2ncias. A detec\u00e7\u00e3o final \u00e9 pelo HTML (td.instance-cell).
    pathInstancias: /^\/(my|report)\//,
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
    pilot: true,                         // true = s\u00f3 liga com localStorage.lcbKanban = 'on'
    keys: { flag: 'lcbKanban', view: 'lcbKanbanView', layout: 'lcbKanbanLayout',
            viewInst: 'lcbKanbanViewInst', layoutInst: 'lcbKanbanLayoutInst' },

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
        'T02': ['triagem', 'ppp'],              // Analisar Processo e Negociar Compra
        'T06': ['triagem', 'ppp'],
        'T03': ['triagem', 'ppf'],              // Cadastrar Cliente no Astrea
        'T04': ['triagem', 'ppf'],              // Aguardando Pr\u00f3xima An\u00e1lise
        'T05': ['triagem', 'ppf']               // Analisar e Classificar Processo PPF
      },
      relacionamento: {
        'T01': ['triagem', 'triagem'],          // Analisar Relacionamento RD
        'T02': ['triagem', 'ppp'],
        'T06': ['triagem', 'ppp'],
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
    nomesArea: { comercial: 'Comercial', financeiro: 'Financeiro', juridico: 'Jur\u00eddico', conselho: 'Conselho', triagem: 'Triagem' },
    // Esteiras por time. Coluna = [id, nome, \u00e1reas, etapas] ('*' = qualquer).
    esteiras: {
      comercial: {
        nome: 'Esteira comercial',
        cols: [
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
          ['ppp', 'PPP (negociar compra)', ['triagem'], ['ppp']],
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
  var flag = ls(CFG.keys.flag);
  if (flag === 'off' || (CFG.pilot && flag !== 'on')) return;
  var MODO = CFG.path.test(location.pathname) ? 'tarefas' :
    CFG.pathInstancias.test(location.pathname) ? 'instancias' : '';
  if (!MODO) return;

  // \u2550\u2550\u2550 UTILIT\u00c1RIOS \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  var DIA = 86400000;
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
  function semDoc(t) {
    return clean(String(t || '')
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '')
      .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '')
      .replace(/\b(cpf|cnpj)\s*:?\s*$/i, ''));
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

  var LAYOUTS = {
    status: {
      nome: 'Por status',
      cols: function () {
        return [
          { id: 'backlog', name: 'Backlog' },
          { id: 'andamento', name: 'Em andamento', precisaB: true, dica: 'Seus leads com participantes' },
          { id: 'fechadas', name: 'Fechadas', precisaB: true, ok: true },
          { id: 'atrasadas', name: 'Atrasadas', alert: true }
        ];
      },
      place: function (it) {
        if (comVoce(it)) return it.late ? 'atrasadas' : 'backlog';
        return it.finalizado ? 'fechadas' : 'andamento';
      }
    },
    negociacao: {
      nome: 'Esteira comercial',
      cols: function () {
        return [{ id: 'backlog', name: 'Backlog' }]
          .concat(colunasEsteira('comercial'))
          .concat([{ id: 'outros', name: 'Outras etapas', opcional: true },
                   { id: 'fechadas', name: 'Fechadas', precisaB: true, ok: true }]);
      },
      place: function (it) {
        if (comVoce(it)) return 'backlog';
        if (!it.meuNeg) return null;
        if (it.finalizado) return 'fechadas';
        return colunaDe('comercial', it);
      }
    },
    juridico: {
      nome: 'Esteira jur\u00eddica',
      cols: function () {
        return colunasEsteira('juridico').map(function (c) { c.precisaB = false; return c; })
          .concat([{ id: 'outros', name: 'Outras \u00e1reas', opcional: true }]);
      },
      place: function (it) {
        if (!comVoce(it)) return null;              // aqui s\u00f3 entram as tarefas da pessoa
        return colunaDe('juridico', it);
      }
    },
    triagem: {
      nome: 'Esteira de triagem',
      cols: function () {
        return [
          { id: 'backlog', name: 'Backlog' },
          { id: 'aguardando', name: 'Aguardando no Pai', precisaB: true },
          { id: 'encaminhado', name: 'Em negocia\u00e7\u00e3o', precisaB: true, dica: 'J\u00e1 na esteira de negocia\u00e7\u00e3o' },
          { id: 'encerrados', name: 'Encerrados', precisaB: true, ok: true }
        ];
      },
      place: function (it) {
        if (comVoce(it)) return 'backlog';
        if (!it.meuTri) return null;
        if (it.finalizado) return 'encerrados';
        return it.tipo !== 'pai' ? 'encaminhado' : 'aguardando';
      }
    },
    equipe: {
      nome: 'Vis\u00e3o da equipe',
      restrito: true,
      cols: function () {
        return [{ id: 'triagem', name: 'Triagem', precisaB: true }]
          .concat(colunasEsteira('comercial'))
          .concat([{ id: 'outros', name: 'Outras etapas', opcional: true },
                   { id: 'fechadas', name: 'Fechadas', precisaB: true, ok: true }]);
      },
      place: function (it) {
        if (it.finalizado) return 'fechadas';
        if (it.tipo !== 'filho' || it.area === 'triagem') return 'triagem';
        return colunaDe('comercial', it);
      }
    }
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

  function abrirTarefa(t) {
    if (t.link) t.link.click();
    else if (t.taskCell) t.taskCell.click();
    else if (t.tr) t.tr.click();
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
      c.addEventListener('click', function () { abrirTarefa(it); });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirTarefa(it); }
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
    if (it.processo) c.appendChild(el('div', 'lcbk-app', it.processo));

    var tags = el('div', 'lcbk-tags');
    tags.appendChild(el('span', 'lcbk-tipo is-' + it.tipo, NOME_TIPO[it.tipo] || NOME_TIPO.pai));
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
    dono: '',
    fase: ''
  };
  var ui = {};

  function combina(it, q) {
    if (!q) return true;
    return [it.numero, it.titulo, it.processo, it.atividade, it.quem, it.donoNome].join(' ').toLowerCase().indexOf(q) !== -1;
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
    var tarefas = lerTarefas();
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

    var frag = document.createDocumentFragment();
    cols.forEach(function (c) {
      var list = buckets[c.id];
      if (c.opcional && !list.length) return;
      var sec = el('section', 'lcbk-col' + (c.alert ? ' is-alert' : '') + (c.ok ? ' is-ok' : ''));
      var head = el('header', 'lcbk-head');
      var h = el('div');
      h.appendChild(el('h3', null, c.name));
      if (c.dica) h.appendChild(el('small', null, c.dica));
      head.appendChild(h);
      head.appendChild(el('span', 'lcbk-count', String(list.length)));
      sec.appendChild(head);
      var body = el('div', 'lcbk-list');
      if (c.precisaB && B.status !== 'ok') body.appendChild(avisoB());
      else if (!list.length) body.appendChild(el('p', 'lcbk-empty', q ? 'Nada com esse filtro' : 'Nada aqui'));
      ordenar(c.id, list).forEach(function (it) { it._col = c; body.appendChild(card(it, layoutId)); });
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
    ui.status.textContent = st + (ocultos ? (st ? ' | ' : '') + ocultos + ' oculto(s) pelo filtro' : '');
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
      '.lcbk-pessoa .is-stuck{color:#b45f0e;font-weight:600}',
      '.lcbk-pessoa .is-you{color:#3b6fd8}',
      '.lcbk-pessoa.is-on{border-color:#1b2f5c;box-shadow:inset 0 0 0 1px #1b2f5c}',
      '.lcbk-pessoa:focus-visible{outline:2px solid #3b6fd8;outline-offset:2px}',
      '.lcbk-owner{color:#1b2f5c;font-weight:600}',
      '.lcbk-atv{color:#404857;font-weight:500}',
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
    ui.search.placeholder = 'Buscar n\u00ba, nome ou atividade';
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

    ui.status = el('span', 'lcbk-status');
    ui.status.setAttribute('aria-live', 'polite');
    ui.tools.appendChild(ui.status);
    ui.bar.appendChild(ui.tools);

    ui.resumo = el('div');
    ui.board = el('div', 'lcbk-board');
    table.parentNode.insertBefore(ui.bar, table);
    table.parentNode.insertBefore(ui.resumo, table);
    table.parentNode.insertBefore(ui.board, table.nextSibling);
  }

  // \u2550\u2550\u2550 BOOT \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  var timer;
  function schedule() { clearTimeout(timer); timer = setTimeout(render, 150); }

  function boot(tries) {
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
        if (!ui.board.contains(t) && !ui.bar.contains(t) && !ui.resumo.contains(t)) { schedule(); return; }
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
      var nome = '';
      linhas.some(function (l) {
        var m = l.match(/^nome(?: do cliente)?\s*:\s*(.+)$/i);
        if (m) { nome = m[1]; return true; }
        return false;
      });
      var processo = linhas[0] || '';
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
        fila: ativo && /,\s*\+\d+\s*$/.test(resp),
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

  function layoutEsteiraInst(id) {
    return {
      nome: CFG.esteiras[id].nome,
      esteira: id,
      cols: function () {
        return colunasEsteira(id).map(function (c) { c.precisaB = false; return c; })
          .concat([{ id: 'outros', name: 'Outras \u00e1reas', opcional: true, outras: true },
                   { id: 'encerradas', name: 'Encerradas', ok: true }]);
      },
      place: function (it) {
        if (!it.ativo) return 'encerradas';
        return colunaDe(id, it);
      }
    };
  }
  var LAYOUTS_INST = {
    comercial: layoutEsteiraInst('comercial'),
    juridico: layoutEsteiraInst('juridico'),
    triagem: layoutEsteiraInst('triagem'),
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
    var alvo = it.tr.querySelector('a[href]') || it.tr.querySelector(CFG.inst.acao) || it.tr;
    alvo.click();
  }

  function cardInst(it, layoutId) {
    var c = el('article', 'lcbk-card' + (it.late ? ' is-late' : it.today ? ' is-today' : '') +
      (!it.ativo ? ' is-done' : ''));
    c.tabIndex = 0;
    c.setAttribute('role', 'button');
    c.setAttribute('aria-label', 'Abrir ' + it.numero + ' ' + it.titulo);
    c.addEventListener('click', function () { abrirInstancia(it); });
    c.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirInstancia(it); }
    });
    var top = el('div', 'lcbk-top');
    top.appendChild(el('span', 'lcbk-num', it.numero));
    var flag = !it.ativo ? [it.status || 'Encerrada', /rejeit|cancel|reprov|perd/i.test(it.status) ? 'is-lost' : 'is-done'] :
      it.late ? ['Atrasada', ''] : it.today ? ['Vence hoje', 'is-today'] :
      it.fila ? ['Na fila', 'is-stuck'] : null;
    if (flag) top.appendChild(el('span', 'lcbk-flag ' + flag[1], flag[0]));
    c.appendChild(top);
    c.appendChild(el('div', 'lcbk-title', it.titulo));
    if (it.processo) c.appendChild(el('div', 'lcbk-app', it.processo));
    if (it.atividade) c.appendChild(el('div', 'lcbk-app lcbk-atv', it.atividade));
    var tags = el('div', 'lcbk-tags');
    tags.appendChild(el('span', 'lcbk-tipo is-' + it.tipo, NOME_TIPO[it.tipo] || NOME_TIPO.pai));
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
      if (it.quem) foot.appendChild(el('span', 'lcbk-who', (it.fila ? 'Grupo: ' : 'Com ') + it.quem));
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
    busca: ''
  };
  var uiI = {};

  var ESTEIRA_INST_PADRAO = { comercial: 'comercial', juridico: 'juridico', triagem: 'triagem' };
  function layoutInstAtivo() {
    return LAYOUTS_INST[stInst.layout] ? stInst.layout :
      (ESTEIRA_INST_PADRAO[ls('lcbKanbanArea')] || 'comercial');
  }

  function renderInst() {
    if (!uiI.board) return;
    var itens = lerInstancias();
    var layoutId = layoutInstAtivo();
    var L = LAYOUTS_INST[layoutId];
    var foraDaArea = 0;
    var cols = L.cols(), buckets = {}, q = stInst.busca.toLowerCase(), ocultos = 0;
    cols.forEach(function (c) { buckets[c.id] = []; });
    itens.forEach(function (it) {
      var col = L.place(it);
      if (col === 'outros' && L.esteira && !stInst.outras) { foraDaArea++; return; }
      if (!buckets[col]) return;
      if (q && [it.numero, it.titulo, it.processo, it.atividade, it.quem].join(' ').toLowerCase().indexOf(q) === -1) {
        ocultos++;
        return;
      }
      buckets[col].push(it);
    });
    var frag = document.createDocumentFragment();
    cols.forEach(function (c) {
      var list = buckets[c.id];
      if (c.opcional && !list.length) return;
      var sec = el('section', 'lcbk-col' + (c.alert ? ' is-alert' : '') + (c.ok ? ' is-ok' : ''));
      var head = el('header', 'lcbk-head');
      var h = el('div');
      h.appendChild(el('h3', null, c.name));
      if (c.dica) h.appendChild(el('small', null, c.dica));
      head.appendChild(h);
      head.appendChild(el('span', 'lcbk-count', String(list.length)));
      sec.appendChild(head);
      var body = el('div', 'lcbk-list');
      if (!list.length) body.appendChild(el('p', 'lcbk-empty', q ? 'Nada com esse filtro' : 'Nada aqui'));
      list.sort(function (a, b) {
        if (a.late !== b.late) return a.late ? -1 : 1;
        var da = a.due && a.due.date ? a.due.date.getTime() : 8.64e15;
        var db = b.due && b.due.date ? b.due.date.getTime() : 8.64e15;
        return da - db;
      }).forEach(function (it) { it._col = c; body.appendChild(cardInst(it, layoutId)); });
      sec.appendChild(body);
      frag.appendChild(sec);
    });
    uiI.board.replaceChildren(frag);
    uiI.board.style.setProperty('--lcbk-cols', String(uiI.board.children.length));
    uiI.status.textContent = itens.length + ' nesta p\u00e1gina' +
      (foraDaArea ? ' | ' + foraDaArea + ' em outras \u00e1reas' : '') +
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
      ls(CFG.keys.layoutInst, stInst.layout);
      renderInst();
    });
    uiI.tools.appendChild(uiI.layout);
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
    busca.placeholder = 'Buscar n\u00ba, nome ou atividade';
    busca.setAttribute('aria-label', 'Buscar no Kanban');
    var tb;
    busca.addEventListener('input', function () {
      clearTimeout(tb);
      tb = setTimeout(function () { stInst.busca = clean(busca.value); renderInst(); }, 150);
    });
    uiI.tools.appendChild(busca);
    uiI.status = el('span', 'lcbk-status');
    uiI.status.setAttribute('aria-live', 'polite');
    uiI.tools.appendChild(uiI.status);
    uiI.bar.appendChild(uiI.tools);
    uiI.board = el('div', 'lcbk-board');
    container.parentNode.insertBefore(uiI.bar, container);
    container.parentNode.insertBefore(uiI.board, container.nextSibling);
  }

  var timerI;
  function bootInst(tries) {
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
        if (!uiI.board.contains(x) && !uiI.bar.contains(x)) {
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
