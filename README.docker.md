# Guia de Dockerização e Implantação (VPS com Banco de Dados NoSQL Local)

Este documento contém todas as instruções necessárias para rodar o projeto em um servidor VPS utilizando **Docker** e **Docker Compose**, agora de forma **100% independente do Firebase**, utilizando um banco de dados NoSQL **MongoDB** local e persistente.

---

## 📋 Arquivos Configurados no Projeto

1. **`Dockerfile`**: Compila o frontend React/Vite de forma otimizada para produção e expõe o servidor Node/Express executando o backend.
2. **`docker-compose.yml`**: Define dois serviços coordenados:
   - `mongodb`: Banco de dados NoSQL local oficial (imagem `mongo:6.0`).
   - `app`: O seu servidor web Node/Express.
3. **`.dockerignore`**: Garante que arquivos desnecessários de desenvolvimento local não fiquem dentro da imagem final de produção.
4. **`src/firebase.ts`**: Atualizado para uma camada de compatibilidade de alto desempenho que converte os métodos do Firestore em requisições REST otimizadas para o seu banco local MongoDB, com sincronização em tempo real (smart-polling) e login local seguro por e-mail/nome.
5. **`.github/workflows/docker-publish.yml`**: Configuração da pipeline de integração contínua (CI/CD) para compilar e enviar a imagem atualizada automaticamente para o Docker Hub sempre que houver novos commits na branch principal.

---

## ⚡ Automação com GitHub Actions (Docker Hub)

Foi configurada uma pipeline que valida a aplicação e publica a imagem Docker no **Docker Hub** com governança e controle de versão:
- **Ao abrir Pull Request (de `main` para `main-master`):** O GitHub Actions executa a etapa de validação (`test-and-lint`) rodando `npm ci`, checagem de tipos TypeScript (`tsc --noEmit`) e todos os testes automatizados com Vitest.
- **Ao aprovar e mesclar (Merge na branch `main-master`):** Após os testes passarem, a etapa `build-and-push` é autorizada, compilando e publicando automaticamente a imagem atualizada no Docker Hub. Nenhuma publicação para o Docker Hub ocorre antes da aprovação do merge na `main-master`.

### Como Configurar em 3 Passos Simples:

#### 1. Criar um Access Token no Docker Hub
1. Acesse o [Docker Hub](https://hub.docker.com/) e faça login.
2. Vá em **Account Settings** (Configurações da Conta) > **Security** > **Personal Access Tokens**.
3. Clique em **New Access Token**, dê uma descrição (ex: `Github Actions CI`) e selecione as permissões de Escrita (`Read & Write` ou `Read, Write, Delete`).
4. **Copie o token gerado** (você só verá ele uma vez).

#### 2. Configurar os Secrets no Repositório do GitHub
No seu repositório do GitHub onde este código está hospedado:
1. Acesse a aba **Settings** (Configurações).
2. Na barra lateral esquerda, clique em **Secrets and variables** > **Actions**.
3. Clique no botão verde **New repository secret** no canto superior direito.
4. Crie os dois segredos a seguir:
   * **`DOCKERHUB_USERNAME`**: Insira o seu nome de usuário (ID) do Docker Hub.
   * **`DOCKERHUB_TOKEN`**: Cole o Access Token gerado no passo 1.

#### 3. Pronto! Fluxo de trabalho:
1. As alterações são sincronizadas na branch `main`.
2. Você abre uma Pull Request da `main` para a `main-master`. O GitHub Actions executa os testes para garantir a integridade.
3. Ao aprovar e realizar o merge na branch `main-master`, o GitHub Actions compila e envia a nova imagem para o Docker Hub:
   `seu-usuario-do-dockerhub/pdca-system-app:latest` e `seu-usuario-do-dockerhub/pdca-system-app:<short-sha-do-commit>`

---

## 🚀 Passo a Passo para Implantação na VPS

Siga os passos abaixo na sua VPS para subir o sistema:

### 1. Clonar ou Enviar os Arquivos para a VPS
Envie os arquivos do projeto para um diretório de sua escolha na VPS (ex: `/var/www/sistema-pdca`).

```bash
cd /var/www/sistema-pdca
```

### 2. Configurar as Variáveis de Ambiente
Crie um arquivo chamado `.env` na raiz do projeto dentro da VPS com as suas credenciais.

Você pode copiar o arquivo de exemplo:
```bash
cp .env.example .env
```

Abra o arquivo `.env` para edição (ex: com `nano .env`) e insira os dados:
```env
# Insira aqui o conteúdo JSON completo da sua chave de conta de serviço Google para o Drive (sem quebras de linha)
GOOGLE_SERVICE_ACCOUNT_KEY={"type": "service_account", "project_id": ...}

# O ID da pasta pai no Google Drive (já pré-configurado)
GOOGLE_DRIVE_PARENT_FOLDER_ID=1fvFyLFU1QGZkfOxYvreHxtEZVWE8l_96
```

---

### 3. Rodar o Sistema com o Docker Compose
Com o arquivo `.env` configurado, inicie o banco de dados e a aplicação em segundo plano (modo daemon) usando o seguinte comando:

```bash
docker compose up -d --build
```

O Docker irá:
1. Baixar a imagem base do MongoDB e iniciar o banco de dados.
2. Criar um volume Docker nomeado (`mongodb_data`) para garantir que os dados de ações, projetos e usuários fiquem **salvos permanentemente no disco rígido da VPS**.
3. Compilar a imagem do seu app e subir o servidor na porta `3002`.

---

## 🛠️ Comandos Úteis na VPS

### Verificar se os containers estão rodando:
```bash
docker compose ps
```

### Visualizar os Logs do Banco e da Aplicação:
```bash
docker compose logs -f
```

### Parar a Execução de Tudo:
```bash
docker compose down
```

### Reiniciar os Serviços:
```bash
docker compose restart
```

---

## 🔒 Segurança e Acesso de Rede

* **Banco de Dados Protegido**: O MongoDB está configurado para expor a porta `27017` apenas para `127.0.0.1` (localhost da máquina host) e conexões internas do Docker, mantendo seus dados 100% seguros contra ataques externos.
* **Acesso Web**: O app web roda na porta `3002` (`http://IP_DA_SUA_VPS:3002`).
* **Usando Porta 80/443 (Opcional)**: Se quiser que o app responda diretamente no domínio sem a porta `:3002`, recomendamos usar um proxy reverso como o **Nginx** ou **Caddy** instalado na sua VPS apontando para a porta `3002`.
