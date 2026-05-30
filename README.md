![GitHub](https://img.shields.io/github/license/GustavoAdolfo/minhoteca-casos-de-uso-layer)
![npm](https://img.shields.io/npm/v/@gustavoadolfo/minhoteca-casos-de-uso-layer)
![CI](https://github.com/GustavoAdolfo/minhoteca-casos-de-uso-layer/actions/workflows/ci.yml/badge.svg)
![Tests](https://img.shields.io/badge/tests-+100%20passed-success)

# minhoteca-casos-de-uso-layer

**Camada relacionada aos casos de uso e regras de negócio gerais do projeto Minhoteca.**

Este projeto oferece classes e serviços, para acelerar o desenvolvimento das funções Lambda e microsserviços do ecossistema Minhoteca.

## 🎯 Propósito Social

Minhoteca tem como missão facilitar o acesso gratuito à leitura, gestão de empréstimos e organização de pequenas bibliotecas em comunidades, ONGs e projetos sociais, contribuindo para os Objetivos de Desenvolvimento Sustentável (ODS) da ONU — especialmente os que tratam de educação de qualidade e redução das desigualdades.

**Alinhamento aos ODS:**

- 🎓 ODS 4: Educação de Qualidade
- 📚 ODS 10: Redução das Desigualdades
- 💚 ODS 17: Parcerias para a Implementação dos Objetivos

## ✨ Funcionalidades

- Casos de Uso (Use Cases) padronizados e reutilizáveis para `Editora`, `Autor`, `Livro` e `Pais`.
- Implementação de regras de negócio centrais, agnósticas a frameworks de entrega.
- Funções utilitárias de paginação e padronização de respostas para API (`createResult`).
- Tratamento estruturado de logs via integração com a `core-layer`.
- Total integração para implantação automatizada na AWS via **Terraform** como um Lambda Layer.
- Cobertura abrangente de testes unitários com Jest.
- **CI/CD Automatizado:** Build, testes e deploy via GitHub Actions.
- **Pronto para AWS Lambda Layers:** Documentação completa de deployment.
- Versão `0.2.0` com casos de uso completos de `Autor` e melhorias de teste/consistência para `Editora`.

## 🚀 Começar Rápido

### Instalação

Como este pacote é distribuído como um pacote privado/scopado no **GitHub Packages**, você precisa adicionar um arquivo `.npmrc` na raiz do seu projeto consumidor:

```ini
@gustavoadolfo:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${SEU_GITHUB_TOKEN}
```

## 🏗️ Estrutura do Projeto

A hierarquia do projeto está segmentada da seguinte forma:

```text
minhoteca-casos-de-uso-layer/
├── layer/nodejs/src/    # Código-fonte principal empacotado para a AWS Lambda
│   ├── editora/         # Use Cases de Editora (Alterar, Excluir, Listar, Obter)
│   ├── autor/           # Use Cases de Autor (Alterar, Excluir, Listar, Obter)
│   ├── pais/            # Use Cases de País
│   └── util/            # Helpers e Utilitários (ex: processamento de Results)
├── tests/               # Testes unitários com a suíte Jest espelhando a raiz
├── terraform/           # Scripts para criação de infraestrutura na AWS
├── eslint.config.js     # Regras de linting do projeto
└── tsconfig.json        # Configurações do compilador TypeScript (ES2022)
```

## 🤝 Como Contribuir

Contribuições são muito bem-vindas e cruciais para a evolução da Minhoteca!

Para entender o nosso fluxo de submissão de código (_pull requests_), padrões de commits (_Conventional Commits_), convenções do repositório e processo de execução de testes locais, acesse o nosso guia completo em **CONTRIBUTING.md**.

## 📄 Licença

Este projeto está licenciado sob os termos da Licença **MIT**. Consulte o arquivo LICENSE.md para maiores detalhes.

---

**Obrigado por apoiar a Minhoteca! 🎉**
