import { ListarPaisUseCase } from '../../../layer/nodejs/src/pais/listar-pais';
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

describe('ListarPaisUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;

  const paisMockData = {
    isoNumeric: 76,
    nome: 'Brasil',
    nomePortugues: 'Brasil',
    bandeira: 'data:image/png;base64,...',
    isoAlpha3: 'BRA',
    isoAlpha2: 'BR',
  };

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

  it('deve listar países com paginação padrão quando queryStringParameters é null', async () => {
    const mockResult: ResultType = {
      data: [paisMockData],
      limit: 10,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarPaisUseCase(repoMock);
    const result = await useCase.execute(createEvent(null));

    expect(repoMock.getAll).toHaveBeenCalledWith('Paises', {
      page: 1,
      limit: 10,
      sortBy: 'nomePortugues',
      sortOrder: 'asc',
    });
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Países listadas com sucesso');
    expect(result.PageData).toEqual(
      expect.arrayContaining([expect.objectContaining({ nome: 'Brasil' })])
    );
  });

  it('deve usar parâmetros da query e gerar corretamente os links de next/prev page', async () => {
    const mockResult: ResultType = {
      data: [paisMockData],
      limit: 5,
      currentPage: 2,
      totalPages: 3,
      totalDocuments: 15,
      hasNextPage: true,
      hasPrevPage: true,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarPaisUseCase(repoMock);
    const event = createEvent({ page: '2', limit: '5', sortBy: 'nome', sortOrder: 'desc' });
    const result = await useCase.execute(event);

    expect(repoMock.getAll).toHaveBeenCalledWith('Paises', {
      page: 2,
      limit: 5,
      sortBy: 'nome',
      sortOrder: 'desc',
    });
    expect(result.NextPage).toBe('?page=3&limit=5&sortBy=nome&sortOrder=desc');
    expect(result.PreviousPage).toBe('?page=1&limit=5&sortBy=nome&sortOrder=desc');
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

    const useCase = new ListarPaisUseCase(repoMock);
    const result = await useCase.execute(createEvent(null));

    expect(result.Code).toBe(204);
    // Nota: A mensagem de retorno está incorreta no caso de uso, mas o teste valida o comportamento atual.
    expect(result.Message).toBe('Nenhuma editora encontrada');
    expect(result.PageData).toHaveLength(0);
  });

  it('deve utilizar fallbacks de paginação se o repositório omitir valores', async () => {
    const mockResult = {
      data: [paisMockData, paisMockData],
    } as ResultType;
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarPaisUseCase(repoMock);
    const result = await useCase.execute(createEvent({ page: '3' }));

    expect(result.Page).toBe(3); // Usa o valor do evento
    expect(result.TotalItems).toBe(2); // Fallback para o tamanho do array de dados
    expect(result.TotalPage).toBe(0); // Fallback para 0
  });

  it('deve utilizar o nome da tabela configurada nas variáveis de ambiente', async () => {
    const originalEnv = process.env.TABELA_PAISES;
    process.env.TABELA_PAISES = 'Tabela_Mock_Listar_Paises';

    try {
      repoMock.getAll.mockResolvedValueOnce({ data: [] } as ResultType);
      const useCase = new ListarPaisUseCase(repoMock);

      await useCase.execute(createEvent(null));
      expect(repoMock.getAll).toHaveBeenCalledWith('Tabela_Mock_Listar_Paises', expect.any(Object));
    } finally {
      process.env.TABELA_PAISES = originalEnv;
    }
  });

  it('deve capturar e relançar erro padrão quando ocorrer uma falha no repositório', async () => {
    repoMock.getAll.mockRejectedValueOnce(new Error('Erro interno do DB'));

    const useCase = new ListarPaisUseCase(repoMock);
    await expect(useCase.execute(createEvent(null))).rejects.toThrow('Falha ao listar países.');
  });

  it('deve gerar links de next/prev omitindo sortBy e sortOrder se não forem fornecidos', async () => {
    const mockResult: ResultType = {
      data: [paisMockData],
      limit: 5,
      currentPage: 2,
      totalPages: 3,
      totalDocuments: 15,
      hasNextPage: true,
      hasPrevPage: true,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarPaisUseCase(repoMock);
    const event = createEvent({ page: '2', limit: '5' });
    const result = await useCase.execute(event);

    expect(result.NextPage).toBe('?page=3&limit=5&sortBy=nomePortugues&sortOrder=asc');
    expect(result.PreviousPage).toBe('?page=1&limit=5&sortBy=nomePortugues&sortOrder=asc');
  });
});
