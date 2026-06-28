import { ListarEditoraUseCase } from '../../../layer/nodejs/src/editora/listar-editoras';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';

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

describe('ListarEditoraUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;
  let consoleErrorSpy: jest.SpyInstance;

  const editoraMockData = {
    id: '1234567890',
    nome: 'Editora Mock Name',
    email: 'mock@editora.net',
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

  it('deve listar editoras com paginação padrão quando queryStringParameters é null', async () => {
    const mockResult: ResultType = {
      data: [editoraMockData],
      limit: 10,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarEditoraUseCase(repoMock);
    const result = await useCase.execute(createEvent(null));

    expect(repoMock.getAll).toHaveBeenCalledWith('Editoras', {
      page: 1,
      limit: 10,
      sortBy: 'nome',
      sortOrder: 'asc',
    });
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Editoras listadas com sucesso');
    expect(result.PageData).toEqual(
      expect.arrayContaining([expect.objectContaining({ nome: 'Editora Mock Name' })])
    );
  });

  it('deve usar parâmetros da query e gerar corretamente os links de next/prev page', async () => {
    const mockResult: ResultType = {
      data: [editoraMockData],
      limit: 5,
      currentPage: 2,
      totalPages: 3,
      totalDocuments: 15,
      hasNextPage: true,
      hasPrevPage: true,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarEditoraUseCase(repoMock);
    const event = createEvent({ page: '2', limit: '5', sortBy: 'pais', sortOrder: 'desc' });
    const result = await useCase.execute(event);

    expect(repoMock.getAll).toHaveBeenCalledWith('Editoras', {
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
      data: [editoraMockData],
      limit: 5,
      currentPage: 2,
      totalPages: 3,
      totalDocuments: 15,
      hasNextPage: true,
      hasPrevPage: true,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarEditoraUseCase(repoMock);
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

    const useCase = new ListarEditoraUseCase(repoMock);
    const result = await useCase.execute(createEvent(null));

    expect(result.Code).toBe(204);
    expect(result.Message).toBe('Nenhuma editora encontrada');
    expect(result.PageData).toHaveLength(0);
  });

  it('deve utilizar fallbacks de propriedades de paginação se o repository omitir valores (branch coverage)', async () => {
    // Omitindo propriedades como currentPage, totalDocuments, totalPages do retorno
    const mockResult = {
      data: [editoraMockData, editoraMockData],
    } as ResultType;
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarEditoraUseCase(repoMock);
    const result = await useCase.execute(createEvent(null));

    // Como default do useCase: page = 1
    expect(result.Page).toBe(1);
    // Fallback = editoras.length = 2
    expect(result.TotalItems).toBe(2);
    // Fallback = 0
    expect(result.TotalPage).toBe(0);
  });

  it('deve tratar exceção de falta do id no getOwnPropertyDescriptor provendo um fallback', async () => {
    // Objeto sem a chave id para forçar `Object.getOwnPropertyDescriptor(item, 'id')` retornar undefined
    const dataSemId = {
      nome: editoraMockData.nome,
      email: editoraMockData.email,
      website: editoraMockData.website,
      pais: editoraMockData.pais,
    };

    repoMock.getAll.mockResolvedValueOnce({ data: [dataSemId] } as ResultType);

    const useCase = new ListarEditoraUseCase(repoMock);
    const result = await useCase.execute(createEvent(null));

    expect(result.Code).toBe(200);
    // O adapter e entity lidaram graciosamente com a falta do ID (ou geraram/usaram fallback vazio)
    expect(result.PageData).toHaveLength(1);
  });

  it('deve utilizar o nome da tabela configurada nas variáveis de ambiente', async () => {
    const originalEnv = process.env.TABELA_EDITORAS;
    process.env.TABELA_EDITORAS = 'Tabela_Mock_Listar_Editoras';

    try {
      repoMock.getAll.mockResolvedValueOnce({ data: [] } as ResultType);
      const useCase = new ListarEditoraUseCase(repoMock);

      await useCase.execute(createEvent(null));
      expect(repoMock.getAll).toHaveBeenCalledWith(
        'Tabela_Mock_Listar_Editoras',
        expect.any(Object)
      );
    } finally {
      process.env.TABELA_EDITORAS = originalEnv;
    }
  });

  it('deve capturar e relançar erro padrão quando ocorrer uma falha', async () => {
    repoMock.getAll.mockRejectedValueOnce(new Error('Erro interno do DB'));

    const useCase = new ListarEditoraUseCase(repoMock);
    await expect(useCase.execute(createEvent(null))).rejects.toThrow('Falha ao listar editoras.');
  });
});
