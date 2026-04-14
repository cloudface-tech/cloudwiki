# Roteiro de Testes QA — CloudWiki v3.0

**Ambiente:** https://wiki.dev.cultbr.cultura.gov.br
**Data:** 2026-04-14
**Versao:** v3.0.0 (19 commits, 39 arquivos alterados)
**Responsavel:** Time QA CultBR

---

## Instrucoes Gerais

- Testar em **Chrome, Firefox e Safari** (desktop)
- Testar em **mobile** (iPhone Safari, Android Chrome)
- Capturar **screenshot** de cada erro encontrado
- Registrar **console errors** do DevTools (F12 > Console)
- Classificar bugs como: **Bloqueante / Critico / Medio / Baixo**
- Usar usuario admin (com permissao `write:pages` e `manage:pages`)

---

## 1. Pagina Inicial e Navegacao

### 1.1 Carregamento da Home
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 1.1.1 | Acessar https://wiki.dev.cultbr.cultura.gov.br | Home page carrega sem erro, titulo "Pagina Inicial" visivel | |
| 1.1.2 | Verificar console (F12) | Nenhum erro JavaScript (warnings OK) | |
| 1.1.3 | Verificar titulo da aba | "Pagina Inicial - CultBR Wiki" | |

### 1.2 Breadcrumbs
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 1.2.1 | Navegar para pagina com path tipo `nees/transversal/arquitetura` | Breadcrumbs aparecem: Nees > Transversal > Arquitetura | |
| 1.2.2 | Clicar no breadcrumb intermediario (ex: "Transversal") | Navega para `/nees/transversal` | |
| 1.2.3 | Verificar na home page | Breadcrumbs nao aparecem (ou apenas "Home") | |

### 1.3 Table of Contents (TOC)
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 1.3.1 | Abrir pagina longa com multiplos headings | TOC aparece na lateral direita | |
| 1.3.2 | Clicar em item do TOC | Scroll suave ate o heading correspondente | |
| 1.3.3 | Redimensionar janela para < 1200px | TOC desaparece (responsivo) | |
| 1.3.4 | Pagina com menos de 2 headings | TOC nao aparece | |

### 1.4 Metadados da Pagina
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 1.4.1 | Abrir qualquer pagina | Data relativa visivel (ex: "ha 3 dias") | |
| 1.4.2 | Verificar tempo de leitura | "X min de leitura" visivel | |

### 1.5 Navegacao Sidebar
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 1.5.1 | Expandir/colapsar itens da sidebar | Funciona sem erro | |
| 1.5.2 | Paginas `teste/*` | NAO devem aparecer (foram unpublished) | |

---

## 2. Editor Milkdown

### 2.1 Abertura do Editor
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 2.1.1 | Clicar "Editar" em qualquer pagina | Editor Milkdown abre com toolbar visivel | |
| 2.1.2 | Verificar console | Nenhum erro "Right side of assignment" ou similar | |
| 2.1.3 | Conteudo da pagina aparece no editor | Texto existente carregado corretamente | |

### 2.2 Toolbar
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 2.2.1 | Clicar **Bold** (B) | Texto selecionado fica negrito | |
| 2.2.2 | Clicar **Italic** (I) | Texto selecionado fica italico | |
| 2.2.3 | Clicar **Strikethrough** | Texto selecionado fica tachado | |
| 2.2.4 | Clicar **Code** | Texto vira inline code | |
| 2.2.5 | Clicar **H1, H2, H3** | Paragrafo vira heading do nivel correto | |
| 2.2.6 | Clicar **Bullet list** | Lista nao ordenada criada | |
| 2.2.7 | Clicar **Numbered list** | Lista ordenada criada | |
| 2.2.8 | Clicar **Blockquote** | Bloco de citacao criado | |
| 2.2.9 | Clicar **Code block** | Bloco de codigo criado | |
| 2.2.10 | Clicar **Horizontal rule** | Linha horizontal inserida | |
| 2.2.11 | Clicar **Link** | Dialog pede URL, link inserido | |
| 2.2.12 | Clicar **Image** | Dialog pede URL, imagem inserida | |
| 2.2.13 | Clicar **Table** | Tabela inserida | |

### 2.3 Source Mode
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 2.3.1 | Clicar icone `</>` (source toggle) | Editor muda pra textarea com Markdown raw | |
| 2.3.2 | Editar Markdown no source mode | Alteracoes refletidas | |
| 2.3.3 | Clicar toggle novamente | Volta pra modo visual | |

### 2.4 Autosave
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 2.4.1 | Editar texto e esperar 30 segundos | Status bar mostra "Saved..." | |
| 2.4.2 | Recarregar pagina apos autosave | Alteracoes persistidas | |

### 2.5 Status Bar
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 2.5.1 | Verificar status bar na parte inferior | Mostra: badge Collab/Local, word count, "Markdown" | |
| 2.5.2 | Digitar texto | Word count atualiza em tempo real | |

### 2.6 Image Drag & Drop
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 2.6.1 | Arrastar imagem do desktop pro editor | Imagem aparece no editor (ou mensagem de upload) | |
| 2.6.2 | Colar imagem (Ctrl+V) | Imagem processada | |

### 2.7 Salvar e Fechar
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 2.7.1 | Clicar "Salvar" | Pagina salva, notificacao positiva | |
| 2.7.2 | Clicar "Descartar" | Editor fecha, conteudo reverte | |
| 2.7.3 | Verificar que razao de alteracao e pedida | Modal aparece pedindo motivo (se configurado) | |

---

## 3. Comentarios

### 3.1 Visualizacao
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 3.1.1 | Scroll ate final da pagina | Secao "Comentarios (N)" visivel | |
| 3.1.2 | Sem comentarios | Mensagem "Nenhum comentario ainda" | |

### 3.2 Criar Comentario (autenticado)
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 3.2.1 | Digitar texto no campo | Botao "Comentar" fica habilitado | |
| 3.2.2 | Clicar "Comentar" | Comentario aparece na lista | |
| 3.2.3 | Digitar `@nome` | Autocomplete sugere usuarios | |
| 3.2.4 | Selecionar usuario do autocomplete | `@nome` inserido no texto | |
| 3.2.5 | Comentario renderiza `@nome` em azul/bold | Mention destacada visualmente | |

### 3.3 Criar Comentario (anonimo)
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 3.3.1 | Deslogar e acessar pagina | Campo "Seu nome" aparece | |
| 3.3.2 | Checkbox LGPD aparece | "Concordo com o armazenamento..." visivel | |
| 3.3.3 | Sem aceitar LGPD | Botao "Comentar" desabilitado | |
| 3.3.4 | Aceitar LGPD e comentar | Comentario criado com nome informado | |

### 3.4 Reply
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 3.4.1 | Clicar icone de reply em comentario | Campo de resposta aparece abaixo | |
| 3.4.2 | Digitar e enviar reply | Reply aparece indentada sob o comentario pai | |

### 3.5 Deletar
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 3.5.1 | Logado: icone lixeira visivel | Sim | |
| 3.5.2 | Deslogado: icone lixeira | NAO deve aparecer | |
| 3.5.3 | Clicar lixeira | Comentario (e replies) removidos | |

### 3.6 Seguranca XSS
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 3.6.1 | Comentar com `<script>alert(1)</script>` | Script NAO executa, texto aparece sanitizado | |
| 3.6.2 | Comentar com `<img src=x onerror=alert(1)>` | Imagem nao carrega, sem alert | |
| 3.6.3 | Comentar com `<a href="javascript:alert(1)">click</a>` | Link nao executa JavaScript | |

---

## 4. Permissoes

### 4.1 Dialog
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 4.1.1 | Clicar "Permissoes" no header da pagina | Dialog abre com lista de permissoes | |
| 4.1.2 | Botao so visivel pra admin (`manage:pages`) | Usuarios sem permissao nao veem o botao | |

### 4.2 Adicionar Permissao
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 4.2.1 | Selecionar Type: User, digitar ID, Level: Write | Campos preenchidos | |
| 4.2.2 | Clicar "Add" | Permissao aparece na lista com badge colorido | |
| 4.2.3 | Repetir com mesmo user mas Level: Admin | Permissao atualizada (upsert), nao duplicada | |

### 4.3 Remover Permissao
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 4.3.1 | Clicar lixeira na permissao | Permissao removida da lista | |

---

## 5. Traducao

### 5.1 Dialog
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 5.1.1 | Clicar "Traduzir" no header | Dialog abre com select de idioma | |
| 5.1.2 | Idioma atual NAO aparece na lista | Correto (ex: se pagina e PT, PT nao ta na lista) | |

### 5.2 Traduzir
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 5.2.1 | Selecionar "English" e clicar "Translate" | Banner verde: "Page created as draft at /en/..." | |
| 5.2.2 | Tentar traduzir novamente pro mesmo idioma | Erro 409: "Page already exists" | |
| 5.2.3 | Usar custom path | Pagina criada no path especificado | |

---

## 6. Templates

### 6.1 Listar Templates
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 6.1.1 | GET /api/mcp/templates no browser | Retorna 5 templates (ata, adr, runbook, onboarding, projeto) | |

### 6.2 Criar a partir de Template
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 6.2.1 | Usar template picker (se disponivel na UI) | Lista templates com icones | |
| 6.2.2 | Selecionar template, preencher titulo e path | Pagina criada com conteudo do template | |

---

## 7. Busca

### 7.1 Busca Normal
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 7.1.1 | Digitar termo na barra de busca e Enter | Pagina de resultados com paginas encontradas | |
| 7.1.2 | Ctrl+K | Foco vai pra barra de busca | |

### 7.2 AI Q&A
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 7.2.1 | Clicar toggle robot na barra de busca | Icone muda pra robot, badge "Ask AI" | |
| 7.2.2 | Digitar pergunta e Enter | Resultados com score circular e excerpts | |
| 7.2.3 | Clicar resultado | Navega pra pagina | |
| 7.2.4 | Desativar toggle | Volta pra busca normal | |

---

## 8. API MCP (testes via curl/Postman)

### 8.1 Leitura
| # | Endpoint | Resultado Esperado | Status |
|---|----------|-------------------|--------|
| 8.1.1 | `GET /api/mcp/manifest` | JSON com version 3.0.0 | |
| 8.1.2 | `GET /api/mcp/pages?limit=5` | Lista paginada | |
| 8.1.3 | `GET /api/mcp/search?q=manual` | Resultados com excerpts | |
| 8.1.4 | `GET /api/mcp/recent` | Ultimas paginas atualizadas | |
| 8.1.5 | `GET /api/mcp/templates` | 5 templates | |
| 8.1.6 | `GET /api/mcp/stale?days=90` | Paginas desatualizadas | |

### 8.2 Escrita (CRUD)
| # | Endpoint | Resultado Esperado | Status |
|---|----------|-------------------|--------|
| 8.2.1 | `POST /api/mcp/pages` com `{"title":"QA Test","path":"qa/test-01","content":"# Test","format":"markdown"}` | 201, pagina criada | |
| 8.2.2 | `GET /api/mcp/pages/{id}` | Retorna pagina criada | |
| 8.2.3 | `PUT /api/mcp/pages/{id}` com `{"title":"QA Test Updated"}` | Titulo atualizado | |
| 8.2.4 | `DELETE /api/mcp/pages/{id}` | Pagina deletada, `deleted: true` | |
| 8.2.5 | `POST /api/mcp/pages` com path duplicado | 409 Conflict | |

### 8.3 AI
| # | Endpoint | Resultado Esperado | Status |
|---|----------|-------------------|--------|
| 8.3.1 | `POST /api/mcp/ask` com `{"question":"como configurar"}` | Resultados rankeados com score | |
| 8.3.2 | `POST /api/mcp/translate` com `{"pageId":"...","targetLocale":"en"}` | 201, draft criado | |

### 8.4 Historico
| # | Endpoint | Resultado Esperado | Status |
|---|----------|-------------------|--------|
| 8.4.1 | `GET /api/mcp/pages/{id}/history` | Lista de versoes | |
| 8.4.2 | `GET /api/mcp/pages/{id}/diff?from={versionId}` | Diff com changes | |

### 8.5 Docs Portal
| # | Endpoint | Resultado Esperado | Status |
|---|----------|-------------------|--------|
| 8.5.1 | `GET /api/mcp/docs/home` | HTML limpo da pagina home (sem login) | |
| 8.5.2 | `GET /api/mcp/docs-index` | Lista completa com tree structure | |

---

## 9. Visual e Responsividade

### 9.1 Desktop (1920x1080)
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 9.1.1 | Headings H1, H2, H3 | Tamanho proporcional, nao gigantes | |
| 9.1.2 | Blockquotes | Border esquerda fina (4px), nao grossa | |
| 9.1.3 | Sidebar + conteudo + TOC | Layout em 3 colunas | |

### 9.2 Mobile (375x812)
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 9.2.1 | Pinch-to-zoom | Funciona (nao esta bloqueado) | |
| 9.2.2 | Sidebar | Colapsa em menu hamburger | |
| 9.2.3 | TOC | Escondida automaticamente | |
| 9.2.4 | Editor toolbar | Nao transborda (scroll horizontal ou wrap) | |

### 9.3 Dark Mode
| # | Passo | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 9.3.1 | Ativar dark mode | Todas areas respeitam tema escuro | |
| 9.3.2 | Editor no dark mode | Toolbar, conteudo, status bar em dark | |
| 9.3.3 | Comentarios no dark mode | Legivel, contraste adequado | |

---

## 10. Seguranca

| # | Teste | Resultado Esperado | Status |
|---|-------|-------------------|--------|
| 10.1 | Acessar `/api/mcp/pages` sem API key (se configurada) | 401 Unauthorized | |
| 10.2 | Enviar `<script>` no titulo de pagina via API | Script sanitizado, nao executa | |
| 10.3 | Rate limit: enviar 25 requests pra `/api/mcp/ask` em 1 minuto | Apos 20, recebe 429 Too Many Requests | |
| 10.4 | Tentar `?apiKey=xxx` na URL | NAO deve funcionar (removido) | |

---

## Criterios de Aprovacao

- [ ] **Zero bugs bloqueantes** (app nao crasha, editor abre)
- [ ] **Zero XSS** (todos testes secao 3.6 passam)
- [ ] **Editor funcional** em Chrome, Firefox, Safari
- [ ] **Todos endpoints API** retornam status correto (secao 8)
- [ ] **Mobile** usavel (zoom funciona, layout nao quebra)
- [ ] **Comentarios** criam, listam, deletam sem erro
- [ ] **Busca AI** retorna resultados relevantes

---

## Template de Bug Report

```
**Titulo:** [Breve descricao]
**Severidade:** Bloqueante / Critico / Medio / Baixo
**Ambiente:** Chrome 130 / macOS 15 / Desktop
**Passos:**
1. ...
2. ...
3. ...
**Resultado esperado:** ...
**Resultado obtido:** ...
**Screenshot:** [anexar]
**Console errors:** [copiar]
```

---

*Roteiro gerado em 2026-04-14 para CloudWiki v3.0.0 — 19 commits, 39 arquivos, 1046 testes automatizados + 9 E2E*
