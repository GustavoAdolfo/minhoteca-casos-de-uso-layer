import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { LogService } from '@gustavoadolfo/minhoteca-core-layer';
import { APIGatewayEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { ObterEmprestimoUseCase } from '../../../layer/nodejs/src/emprestimo/obter-emprestimo';

jest.mock('@gustavoadolfo/minhoteca-core-layer', () => {
  const actual = jest.requireActual('@gustavoadolfo/minhoteca-core-layer');
  return {
    ...actual,
    LogService: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    })),
  };
});

describe('ObterEmprestimoUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;
  let livroRepoMock: jest.Mocked<RepositoryInterface>;

  const createEvent = (
    queryStringParameters: Record<string, string> | null = null
  ): APIGatewayEvent =>
    ({
      queryStringParameters,
    }) as unknown as APIGatewayEvent;

  const createResult = (data: unknown): ResultType => ({
    data,
    currentPage: 1,
    totalPages: 1,
    totalDocuments: Array.isArray(data) ? data.length : 1,
    hasNextPage: false,
    hasPrevPage: false,
    limit: 10,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    repoMock = {
      saveData: jest.fn(),
      getAll: jest.fn(),
      getData: jest.fn(),
      queryData: jest.fn(),
      updateByMinhotecaId: jest.fn(),
      deleteByMinhotecaId: jest.fn(),
      removeData: jest.fn(),
      findByMinhotecaId: jest.fn(),
      getListByMinhotecaIds: jest.fn(),
      getCountFromTable: jest.fn(),
    } as unknown as jest.Mocked<RepositoryInterface>;

    livroRepoMock = {
      ...repoMock,
      findByMinhotecaId: jest.fn(),
    } as unknown as jest.Mocked<RepositoryInterface>;
  });

  const getLogServiceErrorMock = (): jest.Mock => {
    const logServiceInstance = (LogService as unknown as jest.Mock).mock.results.at(-1)?.value as
      { error: jest.Mock } | undefined;

    if (!logServiceInstance) {
      throw new Error('LogService mock não foi inicializado.');
    }

    return logServiceInstance.error;
  };

  it('deve obter o empréstimo pelo usuarioId e retornar os dados corretamente', async () => {
    repoMock.getData.mockResolvedValueOnce(
      createResult([
        {
          usuarioId: 'usuario-123',
          livroId: 'livro-456',
          situacao: 'ATIVO',
          solicitacaoDataHora: '2026-09-13T08:00:00.000Z',
        },
      ])
    );

    const useCase = new ObterEmprestimoUseCase(repoMock);
    const event = createEvent({ usuarioId: 'usuario-123' });

    const result = await useCase.execute(event, 'execucao-123');

    expect(repoMock.getData).toHaveBeenCalledWith('EmprestimoUsuario', {
      name: 'usuarioId',
      value: 'usuario-123',
      type: 'S',
    });
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Empréstimos obtidos com sucesso');
    expect(result.PageData).toEqual([
      expect.objectContaining({
        usuarioId: 'usuario-123',
        livroId: 'livro-456',
        situacao: 'ATIVO',
      }),
    ]);
  });

  it('deve obter o empréstimo pelo livroId e enriquecer o resultado com os dados do livro', async () => {
    repoMock.getData.mockResolvedValueOnce(
      createResult([
        {
          usuarioId: 'usuario-999',
          livroId: 'livro-456',
          situacao: 'PENDENTE',
          solicitacaoDataHora: '2026-09-13T09:00:00.000Z',
        },
      ])
    );

    livroRepoMock.findByMinhotecaId.mockResolvedValueOnce(
      createResult([
        {
          id: 'livro-456',
          titulo: 'Livro 456',
        },
      ])
    );

    const useCase = new ObterEmprestimoUseCase(repoMock, livroRepoMock);
    const event = createEvent({ livroId: 'livro-456' });

    const result = await useCase.execute(event, 'execucao-456');

    expect(repoMock.getData).toHaveBeenCalledWith('EmprestimoLivros', {
      name: 'livroId',
      value: 'livro-456',
      type: 'S',
    });
    expect(livroRepoMock.findByMinhotecaId).toHaveBeenCalledWith('Livros', 'livro-456');
    expect(result.Code).toBe(200);
    expect(result.PageData).toEqual([
      expect.objectContaining({
        usuarioId: 'usuario-999',
        livroId: 'livro-456',
        situacao: 'PENDENTE',
        livro: [
          expect.objectContaining({
            id: 'livro-456',
            titulo: 'Livro 456',
          }),
        ],
      }),
    ]);
  });

  it('deve obter o empréstimo pelo usuarioId e enriquecer o resultado com os dados do livro', async () => {
    repoMock.getData.mockResolvedValueOnce(
      createResult([
        {
          usuarioId: 'usuario-321',
          livroId: 'livro-789',
          situacao: 'ATIVO',
          solicitacaoDataHora: '2026-09-14T09:00:00.000Z',
        },
      ])
    );

    livroRepoMock.findByMinhotecaId.mockResolvedValueOnce(
      createResult([
        {
          id: 'livro-789',
          titulo: 'Livro 789',
        },
      ])
    );

    const useCase = new ObterEmprestimoUseCase(repoMock, livroRepoMock);
    const event = createEvent({ usuarioId: 'usuario-321' });

    const result = await useCase.execute(event, 'execucao-789');

    expect(livroRepoMock.findByMinhotecaId).toHaveBeenCalledWith('Livros', 'livro-789');
    expect(result.Code).toBe(200);
    expect(result.PageData).toEqual([
      expect.objectContaining({
        usuarioId: 'usuario-321',
        livroId: 'livro-789',
        situacao: 'ATIVO',
        livro: [
          expect.objectContaining({
            id: 'livro-789',
            titulo: 'Livro 789',
          }),
        ],
      }),
    ]);
  });

  it('deve retornar lista vazia quando a consulta ao usuário não possuir dados', async () => {
    repoMock.getData.mockResolvedValueOnce(createResult(undefined));

    const useCase = new ObterEmprestimoUseCase(repoMock);
    const result = await useCase.execute(createEvent({ usuarioId: 'sem-dados' }));

    expect(result.PageData).toEqual([]);
  });

  it('deve remover métodos internos quando o item aninhado estiver indexado por 0', () => {
    const useCase = new ObterEmprestimoUseCase(repoMock) as unknown as {
      stripInternalMethods: (data: unknown) => unknown;
    };
    const nested = {
      usuarioId: 'usuario-nested',
      livroId: 'livro-nested',
      situacao: 'ATIVO',
      solicitacaoDataHora: '2026-09-14T10:00:00.000Z',
    };

    const result = useCase.stripInternalMethods({ '0': nested });

    expect(result).toEqual(nested);
  });

  it('deve desempacotar o empréstimo quando o repositório retornar um objeto indexado por 0', async () => {
    const emprestimo = {
      usuarioId: 'usuario-indexado',
      livroId: 'livro-indexado',
      situacao: 'PENDENTE',
      solicitacaoDataHora: 'sábado, 19/09/2026, 17:00:00 GMT-03:00',
    };

    repoMock.getData.mockResolvedValueOnce(createResult({ 0: emprestimo }));

    const useCase = new ObterEmprestimoUseCase(repoMock);
    const result = await useCase.execute(createEvent({ usuarioId: 'usuario-indexado' }));

    expect(result.PageData).toEqual([expect.objectContaining(emprestimo)]);
    expect(result.PageData?.[0]).not.toHaveProperty('0');
  });

  it('deve utilizar as tabelas configuradas nas variáveis de ambiente', async () => {
    const originalUsuario = process.env.TABELA_EMPRESTIMO_USUARIO;
    const originalLivro = process.env.TABELA_EMPRESTIMO_LIVROS;

    process.env.TABELA_EMPRESTIMO_USUARIO = 'TabelaEmprestimoUsuarioMock';
    process.env.TABELA_EMPRESTIMO_LIVROS = 'TabelaEmprestimoLivrosMock';

    try {
      repoMock.getData.mockResolvedValueOnce(
        createResult([
          {
            usuarioId: 'usuario-env',
            livroId: 'livro-env',
            situacao: 'DEVOLVIDO',
            solicitacaoDataHora: '2026-09-13T10:00:00.000Z',
          },
        ])
      );
      repoMock.getData.mockResolvedValueOnce(
        createResult([
          {
            usuarioId: 'usuario-env-2',
            livroId: 'livro-env',
            situacao: 'ATRASADO',
            solicitacaoDataHora: '2026-09-13T11:00:00.000Z',
          },
        ])
      );

      const useCase = new ObterEmprestimoUseCase(repoMock);
      await useCase.execute(createEvent({ usuarioId: 'usuario-env', livroId: 'livro-env' }));

      expect(repoMock.getData).toHaveBeenNthCalledWith(1, 'TabelaEmprestimoUsuarioMock', {
        name: 'usuarioId',
        value: 'usuario-env',
        type: 'S',
      });
      expect(repoMock.getData).toHaveBeenNthCalledWith(2, 'TabelaEmprestimoLivrosMock', {
        name: 'livroId',
        value: 'livro-env',
        type: 'S',
      });
    } finally {
      if (originalUsuario === undefined) {
        delete process.env.TABELA_EMPRESTIMO_USUARIO;
      } else {
        process.env.TABELA_EMPRESTIMO_USUARIO = originalUsuario;
      }

      if (originalLivro === undefined) {
        delete process.env.TABELA_EMPRESTIMO_LIVROS;
      } else {
        process.env.TABELA_EMPRESTIMO_LIVROS = originalLivro;
      }
    }
  });

  it('deve exigir ao menos um identificador para consultar o empréstimo', async () => {
    const useCase = new ObterEmprestimoUseCase(repoMock);

    await expect(useCase.execute(createEvent())).rejects.toThrow(
      'Nenhum identificador de usuário ou livro fornecido.'
    );
  });

  it('deve lançar erro quando o repositório falhar ao consultar o empréstimo', async () => {
    repoMock.getData.mockRejectedValueOnce(new Error('Erro interno no banco de dados'));

    const useCase = new ObterEmprestimoUseCase(repoMock);
    const event = createEvent({ usuarioId: 'usuario-erro' });

    await expect(useCase.execute(event, 'execucao-erro')).rejects.toThrow(
      'Falha ao obter empréstimos.'
    );
    expect(getLogServiceErrorMock()).toHaveBeenCalled();
  });
});
