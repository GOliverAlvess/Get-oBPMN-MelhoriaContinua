# Guia de Dockerização e Implantação (VPS)

Este documento contém todas as instruções necessárias para dockerizar e rodar o projeto em um servidor VPS com o Docker e o Docker Compose instalados.

---

## 📋 Arquivos Criados no Projeto

1. **`Dockerfile`**: Arquivo de definição para compilação da imagem utilizando multi-stage build (Node.js Alpine), separando a fase de compilação dos recursos estáticos (Vite) da fase de execução (Node + Express + `tsx`).
2. **`.dockerignore`**: Exclui arquivos desnecessários (`node_modules`, `dist`, `.env`, logs) do contexto de compilação do Docker para tornar a imagem leve e segura.
3. **`docker-compose.yml`**: Configuração simplificada para gerenciar o container, portas de acesso, volumes de logs e variáveis de ambiente.

---

## 🚀 Passo a Passo para Implantação na VPS

Siga os passos abaixo na sua VPS para subir o sistema:

### 1. Clonar ou Enviar os Arquivos para a VPS
Envie os arquivos do projeto para um diretório de sua escolha na VPS (ex: `/var/www/sistema-pdca`). Você pode fazer isso via Git, FTP ou `scp`.

```bash
cd /var/www/sistema-pdca
```

### 2. Configurar as Variáveis de Ambiente
Crie um arquivo chamado `.env` na raiz do projeto dentro da VPS com as suas credenciais. O arquivo `.env` **não** deve ser enviado ao repositório público por questões de segurança.

Você pode copiar o arquivo de exemplo:
```bash
cp .env.example .env
```

Abra o arquivo `.env` para edição (ex: com `nano .env`) e insira os dados:
```env
# Insira aqui o conteúdo JSON completo da sua chave de conta de serviço Google (sem quebras de linha)
GOOGLE_SERVICE_ACCOUNT_KEY={"type": "service_account", "project_id": ...}

# O ID da pasta pai no Google Drive (já pré-configurado)
GOOGLE_DRIVE_PARENT_FOLDER_ID=1fvFyLFU1QGZkfOxYvreHxtEZVWE8l_96
```

> **Dica para a chave do Google Cloud**: A chave `GOOGLE_SERVICE_ACCOUNT_KEY` é o JSON de uma única linha contendo as credenciais baixadas do Google Cloud Console.

### 3. Rodar o Sistema com o Docker Compose
Com o arquivo `.env` configurado, você pode compilar a imagem e iniciar o serviço em segundo plano (modo daemon) usando o seguinte comando:

```bash
docker compose up -d --build
```

O Docker irá:
1. Baixar a imagem base do Node 20 Alpine.
2. Instalar as dependências do projeto.
3. Compilar o frontend React/Vite na pasta `/dist`.
4. Copiar os arquivos necessários para o container de produção final.
5. Iniciar o servidor Express na porta `3000`.

---

## 🛠️ Comandos Úteis na VPS

### Verificar se o container está rodando:
```bash
docker compose ps
```

### Visualizar os Logs em Tempo Real:
```bash
docker compose logs -f
```

### Parar a Execução do Container:
```bash
docker compose down
```

### Reiniciar o Container:
```bash
docker compose restart
```

---

## 🔒 Acesso e Porta de Rede

O container expõe internamente a porta `3000`. No arquivo `docker-compose.yml`, mapeamos:
* `"3000:3000"` (Porta do Host : Porta do Container)

Isso significa que você poderá acessar o sistema no navegador por:
`http://IP_DA_SUA_VPS:3000`

Se você deseja usar a porta padrão HTTP (`80`) ou HTTPS (`443`) diretamente sem especificar a porta `:3000`, você pode alterar o mapeamento de portas no `docker-compose.yml` para `"80:3000"` ou usar um Proxy Reverso como **Nginx** ou **Caddy** na sua VPS para encaminhar as requisições para a porta `3000`.
