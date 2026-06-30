# 📊 Sistema PDCA (Plan-Do-Check-Act) - Documentação de Arquitetura & Implantação

Seja bem-vindo à documentação técnica do **Sistema PDCA**, uma plataforma robusta projetada para a gestão de planos de ação, identificação de causas raízes, acompanhamento de projetos e conformidades organizacionais, com auditoria de logs e integração transparente para gestão de arquivos anexos.

---

## 🎯 1. Objetivo do Projeto

O objetivo principal desta aplicação é permitir que equipes gerenciem o ciclo **PDCA** de forma ágil, colaborativa e segura. O sistema oferece:
*   **Gestão de Projetos e Ações Corretivas:** Criação, atribuição, categorização e acompanhamento de planos de ação.
*   **Controle de Permissões Rígido:** Divisão de responsabilidade com base em perfis de usuários (Master, Analista, Visualizador).
*   **Gestão de Documentos:** Armazenamento centralizado de evidências e arquivos diretamente no Google Drive da organização, criando pastas dinamicamente por projeto.
*   **Persistência Segura e Resiliente:** Banco de dados NoSQL desacoplado e perene para evitar perdas de dados durante atualizações da aplicação.
*   **Automação de Deploy (CI/CD):** Deploy automatizado com Docker, GitHub Actions e atualização contínua sem interrupções.

---

## 💻 2. Tecnologias Utilizadas

A aplicação adota uma arquitetura full-stack moderna com TypeScript em todas as camadas:

### **Frontend (Cliente)**
*   **React 18+ & Vite:** Interface reativa, rápida e com carregamento instantâneo.
*   **Tailwind CSS:** Estilização utilitária altamente customizável e responsiva.
*   **Framer Motion:** Animações fluidas e transições suaves de rotas e elementos visuais.
*   **Lucide React:** Conjunto de ícones vetoriais modernos e consistentes.
*   **Recharts / D3:** Gráficos e dashboards dinâmicos para visualização de métricas e status de ações.

### **Backend (Servidor)**
*   **Node.js & Express:** API RESTful robusta para controle de dados e integrações.
*   **MongoDB (Driver Nativo):** Armazenamento NoSQL rápido e flexível para documentos de usuários, projetos e ações operacionais.
*   **Googleapis (Google Drive API v3):** Comunicação segura com o ecossistema Google Drive via Conta de Serviço (Service Account).
*   **Multer:** Processamento eficiente de uploads de arquivos diretamente em memória para envio ao Drive.

### **Infraestrutura & DevOps**
*   **Docker & Docker Compose:** Containerização completa da aplicação e do banco de dados de forma isolada.
*   **GitHub Actions:** Automação que constrói e publica a imagem Docker no Docker Hub a cada push aprovado.
*   **Watchtower:** Serviço que roda na VPS e atualiza automaticamente o container da aplicação ao identificar uma nova imagem no Docker Hub, sem intervenção manual.
*   **Portainer:** Interface gráfica de gerenciamento de containers e variáveis de ambiente na VPS.

---

## 🧠 3. Lógica do Sistema e Arquitetura

### **A. Separação Backend & Frontend**
O projeto está estruturado em uma arquitetura unificada e otimizada (Full-Stack Monolith):
1.  **Desenvolvimento:** O Vite roda como um middleware integrado ao Express (`server.ts`). As chamadas de API (`/api/*`) são tratadas prioritariamente pelo Express, e qualquer outra rota é repassada para o servidor de desenvolvimento do Vite em tempo real.
2.  **Produção:** O script de build compila o frontend para arquivos estáticos na pasta `dist/`. O servidor Express é compilado em um único pacote otimizado (`dist/server.cjs`) e serve os arquivos de produção estáticos, além de disponibilizar as APIs REST.

### **B. Políticas de Autorização baseadas em Perfis**
As requisições de modificação de dados (`POST`, `PUT`, `DELETE`) na API do banco de dados passam por um validador no servidor (`authorizeMutation`) baseado no e-mail do usuário informado no cabeçalho `x-user-email`:

*   **Usuário Master:** Possui controle total. Pode gerenciar usuários, alterar configurações, criar, editar e excluir qualquer projeto ou ação operacional.
*   **Usuário Analista:**
    *   *Permissões:* Pode ver todas as informações do sistema.
    *   *Restrições:* Só pode editar ou excluir projetos e ações operacionais sob sua responsabilidade direta (onde o campo `assignedTo` ou `responsibleId` corresponde ao seu ID de usuário). Não pode gerenciar usuários nem alterar configurações gerais.
*   **Usuário Visualizador:** Acesso estritamente de leitura. Não pode efetuar nenhuma alteração no banco de dados e não pode fazer upload de arquivos. A única escrita permitida é o registro de logs de visualização e relatórios (`reportLogs`).

### **C. Integração de Arquivos (Google Drive)**
Em vez de sobrecarregar a VPS ou o banco NoSQL, todas as evidências de planos de ação e arquivos de projetos são direcionados ao Google Drive:
1.  **Chave de Serviço Segura:** A autenticação é realizada usando uma **Conta de Serviço (Service Account)** do Google Cloud através da variável `GOOGLE_SERVICE_ACCOUNT_KEY` contendo o JSON de credenciais original completo.
2.  **Criação Dinâmica de Pastas:** Ao enviar um arquivo pela rota `/api/drive/upload`, o servidor verifica se já existe uma pasta com o nome do projeto dentro da pasta mãe (definida pela variável `GOOGLE_DRIVE_PARENT_FOLDER_ID`). Se não existir, a pasta é criada dinamicamente na raiz compartilhada do Drive.
3.  **Armazenamento de Metadados:** O arquivo é carregado na subpasta do projeto e o Drive retorna um ID único, o tamanho, o tipo MIME e um link de visualização web (`webViewLink`), os quais são persistidos no MongoDB associados ao respectivo projeto.

---

## 🌐 4. Mapa de Infraestrutura

Para garantir resiliência e evitar que as atualizações de código limpem os registros do banco de dados, a infraestrutura foi desacoplada na VPS:

```
                                      [ GitHub Repository ]
                                                │ (Git Push)
                                                ▼
                                    [ GitHub Actions Pipeline ]
                                                │ (Build & Push Image)
                                                ▼
                                         [ Docker Hub ]
                                                │
       ┌────────────────────────────────────────┴────────────────────────────────────────┐
       │ (Auto Pull e reinicialização)                                                   │ (Monitoramento)
       ▼                                                                                 ▼
 ┌─────────────── VPS (Servidor Host) ──────────────────────────────────────────────────────────────┐
 │                                                                                                  │
 │  ┌─────────────────────────────────┐                 ┌────────────────────────────────────────┐  │
 │  │      Container: Watchtower      │                 │          Container: Portainer          │  │
 │  │  (Monitora novas imagens no     │                 │   (Interface de gestão de containers   │  │
 │  │   Docker Hub e atualiza o app)  │                 │    e injeção de variáveis de ambiente) │  │
 │  └─────────────────┬───────────────┘                 └───────────────────┬────────────────────┘  │
 │                    │                                                     │                       │
 │                    ▼                                                     ▼                       │
 │  ┌─────────────────────────────────┐                 ┌────────────────────────────────────────┐  │
 │  │        Container: App           │                 │         Container: MongoDB             │  │
 │  │     (Express + React SPA)       │ ──────────────> │      (NoSQL Database Dedicado)         │  │
 │  │                                 │  MONGODB_URI    │                                        │  │
 │  │  * Atualizado constantemente    │                 │  * Container fixo, NUNCA é recriado    │  │
 │  │  * Sem perda de estado          │                 │    durante as atualizações do App.     │  │
 │  │  * Conecta ao MongoDB da VPS    │                 │  * Persiste dados no volume do host.   │  │
 │  └─────────────────────────────────┘                 └────────────────────────────────────────┘  │
 │                                                                                                  │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### **Por que este modelo resolve a perda de dados?**
Anteriormente, o banco MongoDB e a Aplicação rodavam no mesmo arquivo `docker-compose.yml` acoplados. Ao efetuar atualizações de imagens, o compose recriava ambos os serviços, o que podia resultar em reinstanciações do banco de dados e limpezas indesejadas caso os volumes locais não estivessem corretamente mapeados ou sincronizados.

**A Solução de Produção Aplicada:**
1.  **MongoDB Dedicado:** O MongoDB roda como um serviço ou container fixo isolado no Docker da VPS. Ele possui seu próprio volume físico persistente no disco da VPS.
2.  **Container de Aplicação Isolado:** O container da aplicação (compilado via GitHub Actions) roda separadamente e se conecta ao MongoDB da VPS utilizando o IP/porta interna da rede docker ou localhost através da variável `MONGODB_URI`.
3.  **Watchtower Ativo:** Quando você faz um push no GitHub, a imagem da aplicação é atualizada no Docker Hub. O Watchtower na VPS detecta a nova imagem, derruba **apenas** o container `app` e sobe a nova versão. O container do **MongoDB permanece intacto**, garantindo **zero perda de dados** e **zero downtime de banco**.

---

## 🚀 5. Como Executar o Projeto

### **A. Variáveis de Ambiente necessárias (`.env`)**
Crie um arquivo `.env` na raiz do projeto (ou configure diretamente no painel do Portainer na VPS) contendo:

```env
# URL de Conexão com o MongoDB da VPS (Exemplo de rede interna ou local)
MONGODB_URI=mongodb://usuario:senha@ip_do_banco:27017/pdca_system

# JSON Completo da Service Account Google Drive (em linha única, sem quebras de linha físicas)
GOOGLE_SERVICE_ACCOUNT_KEY={"type": "service_account", "project_id": "gip-flow", "private_key_id": "...", "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n", "client_email": "..."}

# ID da pasta mãe compartilhada no Google Drive
GOOGLE_DRIVE_PARENT_FOLDER_ID=0AFf6OFctpR_7Uk9PVA

# Porta de execução do Servidor
PORT=3002
```

> ⚠️ **Atenção:** Nunca suba o arquivo `.env` para o repositório Git público. Mantenha as chaves salvas como **Secrets** no GitHub Actions e injete-as diretamente no Portainer/Docker da VPS.

---

### **B. Execução Local (Modo Desenvolvimento)**

1.  Instale as dependências do projeto:
    ```bash
    npm install
    ```
2.  Inicie o servidor de desenvolvimento (Frontend com HMR e Backend integrados):
    ```bash
    npm run dev
    ```
3.  Acesse `http://localhost:3000` (ou a porta indicada no console).

---

### **C. Construção de Produção Local**

1.  Gere a build de produção otimizada:
    ```bash
    npm run build
    ```
2.  Inicie o servidor de produção local:
    ```bash
    npm start
    ```

---

### **D. Executando via Docker localmente**

Se quiser simular o ambiente de produção localmente com o Docker Compose adaptado:
```bash
docker compose up -d --build
```
Isso iniciará o contêiner da aplicação mapeando a porta `3002`.

---

## 🛠️ 6. Boas Práticas para o Administrador da VPS

1.  **Atualização de Variáveis de Ambiente:** Sempre que alterar o JSON da Conta de Serviço do Google Drive ou as credenciais do banco, faça isso através do painel do **Portainer** ou editando o arquivo de variáveis na VPS e reinicie o container da aplicação:
    ```bash
    docker restart pdca-system-app
    ```
    
2.  **Backups Regulares:** Agende rotinas de backup da pasta de dados física do MongoDB (`/data/db` mapeada na sua VPS) para garantir segurança máxima das informações estratégicas cadastradas no sistema PDCA.

---
*Desenvolvido com foco em alta performance, segurança de arquivos e resiliência de dados.*
