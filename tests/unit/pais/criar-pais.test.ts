import { CriarPaisUseCase } from '../../../layer/nodejs/src/pais/criar-pais';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { PaisAdapter, PaisInvalidoError } from '@gustavoadolfo/minhoteca-core-layer';

// Realizamos o mock parcial da camada core para isolar os testes do UseCase
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

describe('CriarPaisUseCase', () => {
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
      getListByMinhotecaIds: jest.fn(),
    } as jest.Mocked<RepositoryInterface>;
  });

  const createEvent = (body: Record<string, unknown> | null): APIGatewayEvent =>
    ({
      body: body ? JSON.stringify(body) : null,
    }) as APIGatewayEvent;

  it('deve criar um país com sucesso', async () => {
    const mockResult: ResultType = {
      data: { ...paisMockData },
      limit: 1,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.saveData.mockResolvedValueOnce(mockResult);

    const useCase = new CriarPaisUseCase(repoMock);
    const event = createEvent(paisMockData);
    const result = await useCase.execute(event, '123456789');

    expect(repoMock.saveData).toHaveBeenCalledWith(
      'Paises',
      expect.objectContaining({ nome: 'Brasil' })
    );
    expect(result.Code).toBe(201);
    expect(result.Message).toBe('País criado com sucesso');
    expect(result.PageData).toEqual([expect.objectContaining({ nome: 'Brasil' })]);
  });

  it('deve lançar PaisInvalidoError quando o repositório falhar', async () => {
    repoMock.saveData.mockRejectedValueOnce(new Error('Erro de banco de dados'));

    const useCase = new CriarPaisUseCase(repoMock);
    const event = createEvent(paisMockData);

    await expect(useCase.execute(event, '123456789')).rejects.toThrow(
      new PaisInvalidoError('Falha ao criar país.')
    );
  });

  it('deve lançar PaisInvalidoError quando o body for um JSON inválido', async () => {
    const useCase = new CriarPaisUseCase(repoMock);
    const event = { body: '{json:"invalido"' } as APIGatewayEvent;

    await expect(useCase.execute(event, '123456789')).rejects.toThrow(
      new PaisInvalidoError('Falha ao criar país.')
    );
    expect(repoMock.saveData).not.toHaveBeenCalled();
  });

  it('deve lançar PaisInvalidoError quando o body for nulo, resultando em erro de validação', async () => {
    const spyAdapter = jest.spyOn(PaisAdapter, 'fromCreateDTO');
    const useCase = new CriarPaisUseCase(repoMock);
    const event = createEvent(null);

    // A chamada com body nulo fará o adapter ser chamado com '{}', que falhará na validação da entidade.
    await expect(useCase.execute(event, '123456789')).rejects.toThrow(
      new PaisInvalidoError('Falha ao criar país.')
    );

    expect(spyAdapter).toHaveBeenCalledWith({});
    expect(repoMock.saveData).not.toHaveBeenCalled();
  });

  it('deve utilizar o nome da tabela da variável de ambiente se estiver definida', async () => {
    const originalEnv = process.env.TABELA_PAISES;
    process.env.TABELA_PAISES = 'Tabela_Mock_Pais';

    try {
      const mockResult: ResultType = {
        data: { ...paisMockData },
        limit: 1,
        currentPage: 1,
        totalPages: 1,
        totalDocuments: 1,
        hasNextPage: false,
        hasPrevPage: false,
      };
      repoMock.saveData.mockResolvedValueOnce(mockResult);

      const useCase = new CriarPaisUseCase(repoMock);
      const event = createEvent(paisMockData);
      await useCase.execute(event, '123456789');

      expect(repoMock.saveData).toHaveBeenCalledWith('Tabela_Mock_Pais', expect.any(Object));
    } finally {
      process.env.TABELA_PAISES = originalEnv;
    }
  });

  it('deve lançar erro quando a conversão para DTO falhar', async () => {
    const mockResult: ResultType = {
      data: { ...paisMockData },
      limit: 1,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.saveData.mockResolvedValueOnce(mockResult);
    jest.spyOn(PaisAdapter, 'toDTO').mockImplementationOnce(() => {
      throw new Error('Erro de conversão DTO');
    });

    const useCase = new CriarPaisUseCase(repoMock);
    const event = createEvent(paisMockData);

    await expect(useCase.execute(event, '123456789')).rejects.toThrow(
      new PaisInvalidoError('Falha ao criar país.')
    );
  });
});
