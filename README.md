# 🚗 AutoVenda Pro v3.0

CRM mobile-first focado em **relacionamento humano** com clientes B2B.

## ✨ Características

- 📱 **Mobile-first** — projetado para uso no celular
- 🎨 **Tema escuro premium** com verde WhatsApp
- 💬 **WhatsApp integrado** — abre conversa direto
- 📅 **Agenda de retornos** — não perca nenhum follow-up
- 🌡️ **Temperatura automática** — Quente/Morno/Frio baseado no último contato
- 📝 **Histórico de contatos** em linha do tempo
- ☁️ **Sincronização com Google Sheets** — backup automático
- 📥 **Importação CSV/Excel** — migre seus contatos facilmente
- 🔄 **Funciona offline** — sincroniza quando voltar a conexão

## 🚀 Instalação

### 1. Configurar Google Sheets

1. Crie uma nova planilha no Google Sheets
2. Vá em **Extensões → Apps Script**
3. Cole o código de `google-apps-script.js`
4. Salve (Ctrl+S)
5. Clique em **Implantar → Nova implantação**
6. Tipo: **App da Web**
7. Quem acessa: **Qualquer pessoa**
8. Copie a URL gerada

### 2. Configurar o CRM

1. Abra `app.js`
2. Substitua a constante `SHEETS_URL` pela URL do seu Apps Script
3. Ajuste `LOGIN_USER` e `LOGIN_PASS` se desejar
4. Hospede os arquivos (GitHub Pages, Netlify, Vercel, etc.)

### 3. Acessar

Abra o site no celular e faça login!

## 🎯 Filosofia

**O que ESSE CRM É:**
- Lista inteligente de clientes
- Ferramenta de relacionamento humano
- Acompanhamento manual e personalizado
- Foco em conversas reais

**O que ESSE CRM NÃO É:**
- Central de automação
- Disparador de mensagens em massa
- Pipeline complexo
- Software corporativo pesado

## 🎨 Cores

- Verde WhatsApp: `#25D366`
- Vermelho (Quente): `#FF404F`
- Amarelo (Morno): `#FFC107`
- Azul (Frio): `#4DA3FF`
- Fundo: `#0a0e10`

## 📂 Estrutura

```
autovenda-pro/
├── index.html              # Estrutura HTML
├── style.css               # Estilos (design system)
├── app.js                  # Lógica do CRM
├── google-apps-script.js   # Backend Sheets
├── icon.svg                # Ícone
└── README.md               # Este arquivo
```

## 🤝 Funcionalidades

### Tela Inicial (Home)
- Saudação personalizada
- Cards de temperatura (Quentes/Mornos/Frios)
- Próximos clientes para contato

### Clientes
- Lista com busca em tempo real
- Filtros por temperatura
- Avatar colorido por inicial
- Botão WhatsApp direto

### Detalhes do Cliente
- Avatar grande + informações
- Ações rápidas: WhatsApp / Ligar / Anotar / Editar
- Histórico em linha do tempo
- Cópia rápida de telefone/email

### Agenda
- Visão semanal
- Compromissos por data
- Vinculação com cliente
- Indicador visual de dias com eventos

### Mais
- Importar contatos (CSV/Excel)
- Sincronizar com Sheets
- Relatórios
- Backup local

## 📝 Versão 3.0 — Mudanças

Reescrita completa focada em mobile e simplicidade:
- ✅ Removido: Pipeline/Kanban, Automação, Disparos
- ✅ Adicionado: Menu inferior mobile, Agenda, Linha do tempo
- ✅ Redesenhado: Visual moderno e minimalista
