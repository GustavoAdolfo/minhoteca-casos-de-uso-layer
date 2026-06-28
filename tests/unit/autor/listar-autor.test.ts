import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { ListarAutorUseCase } from '../../../layer/nodejs/src/autor';

// Realiza o mock parcial da camada core para consistência com outros testes
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

describe('ListarAutorUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;
  let consoleErrorSpy: jest.SpyInstance;
  const idExecucao = 'test-execution-id';

  const autorMockData = {
    id: '1234567890',
    nome: 'Autor Mock Name',
    email: 'mock@autor.net',
    website: 'http://mock-website.com',
    pais: 'BRA',
  };

  beforeAll(() => {
    // Suprime o console.error gerado pelo bloco catch do caso de uso
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
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
    } as jest.Mocked<RepositoryInterface>;
  });

  const createEvent = (
    queryStringParameters: Record<string, string> | null = null
  ): APIGatewayEvent =>
    ({
      queryStringParameters,
    }) as unknown as APIGatewayEvent;

  it('deve listar autores com paginação padrão quando queryStringParameters é null', async () => {
    const mockResult: ResultType = {
      data: [autorMockData],
      limit: 10,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarAutorUseCase(repoMock, idExecucao);
    const result = await useCase.execute(createEvent(null));

    expect(repoMock.getAll).toHaveBeenCalledWith('Autores', {
      page: 1,
      limit: 10,
      sortBy: 'nome',
      sortOrder: 'asc',
    });
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Autores listados com sucesso');
    expect(result.PageData).toEqual(
      expect.arrayContaining([expect.objectContaining({ nome: 'Autor Mock Name' })])
    );
  });

  it('deve usar parâmetros da query e gerar corretamente os links de next/prev page', async () => {
    const mockResult: ResultType = {
      data: [autorMockData],
      limit: 5,
      currentPage: 2,
      totalPages: 3,
      totalDocuments: 15,
      hasNextPage: true,
      hasPrevPage: true,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarAutorUseCase(repoMock, idExecucao);
    const event = createEvent({ page: '2', limit: '5', sortBy: 'pais', sortOrder: 'desc' });
    const result = await useCase.execute(event);

    expect(repoMock.getAll).toHaveBeenCalledWith('Autores', {
      page: 2,
      limit: 5,
      sortBy: 'pais',
      sortOrder: 'desc',
    });
    expect(result.NextPage).toBe('?page=3&limit=5&sortBy=pais&sortOrder=desc');
    expect(result.PreviousPage).toBe('?page=1&limit=5&sortBy=pais&sortOrder=desc');
  });

  it('deve gerar links de next/prev omitindo sortBy e sortOrder caso sejam ignorados', async () => {
    const mockResult: ResultType = {
      data: [autorMockData],
      limit: 5,
      currentPage: 2,
      totalPages: 3,
      totalDocuments: 15,
      hasNextPage: true,
      hasPrevPage: true,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarAutorUseCase(repoMock, idExecucao);
    // Passando valores vazios para forçar o condicional (sortBy && sortOrder) a ser falso
    const event = createEvent({ page: '2', limit: '5', sortBy: '', sortOrder: '' });
    const result = await useCase.execute(event);

    expect(result.NextPage).toContain('?page=3&limit=5');
    expect(result.PreviousPage).toContain('?page=1&limit=5');
  });

  it('deve retornar status 204 quando não houver registros', async () => {
    const mockResult: ResultType = {
      data: [],
      limit: 10,
      currentPage: 1,
      totalPages: 0,
      totalDocuments: 0,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarAutorUseCase(repoMock, idExecucao);
    const result = await useCase.execute(createEvent(null));

    expect(result.Code).toBe(204);
    expect(result.Message).toBe('Nenhum autor encontrado');
    expect(result.PageData).toHaveLength(0);
  });

  it('deve utilizar fallbacks de propriedades de paginação se o repository omitir valores (branch coverage)', async () => {
    // Omitindo propriedades como currentPage, totalDocuments, totalPages do retorno
    const mockResult = {
      data: [autorMockData, autorMockData],
    } as ResultType;
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarAutorUseCase(repoMock, idExecucao);
    const result = await useCase.execute(createEvent(null));

    // Como default do useCase: page = 1
    expect(result.Page).toBe(1);
    // Fallback = autores.length = 2
    expect(result.TotalItems).toBe(2);
    // Fallback = 0
    expect(result.TotalPage).toBe(0);
  });

  it('deve tratar exceção de falta do id no getOwnPropertyDescriptor provendo um fallback', async () => {
    // Objeto sem a chave id para forçar `Object.getOwnPropertyDescriptor(item, 'id')` retornar undefined
    const dataSemId = {
      nome: autorMockData.nome,
      email: autorMockData.email,
      website: autorMockData.website,
      pais: autorMockData.pais,
    };

    repoMock.getAll.mockResolvedValueOnce({ data: [dataSemId] } as ResultType);

    const useCase = new ListarAutorUseCase(repoMock, idExecucao);
    const result = await useCase.execute(createEvent(null));

    expect(result.Code).toBe(200);
    // O adapter e entity lidaram graciosamente com a falta do ID (ou geraram/usaram fallback vazio)
    expect(result.PageData).toHaveLength(1);
  });

  it('deve utilizar o nome da tabela configurada nas variáveis de ambiente', async () => {
    const originalEnv = process.env.TABELA_AUTORES;
    process.env.TABELA_AUTORES = 'Tabela_Mock_Listar_Autores';

    try {
      repoMock.getAll.mockResolvedValueOnce({ data: [] } as ResultType);
      const useCase = new ListarAutorUseCase(repoMock, idExecucao);

      await useCase.execute(createEvent(null));
      expect(repoMock.getAll).toHaveBeenCalledWith(
        'Tabela_Mock_Listar_Autores',
        expect.any(Object)
      );
    } finally {
      process.env.TABELA_AUTORES = originalEnv;
    }
  });

  it('deve capturar e relançar erro padrão quando ocorrer uma falha', async () => {
    repoMock.getAll.mockRejectedValueOnce(new Error('Erro interno do DB'));

    const useCase = new ListarAutorUseCase(repoMock, idExecucao);
    await expect(useCase.execute(createEvent(null))).rejects.toThrow('Falha ao listar autores.');
  });
});
