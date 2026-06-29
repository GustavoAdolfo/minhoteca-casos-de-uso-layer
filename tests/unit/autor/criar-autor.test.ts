import { CriarAutorUseCase } from '../../../layer/nodejs/src/autor/criar-autor';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { AutorAdapter } from '@gustavoadolfo/minhoteca-core-layer';

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

describe('CriarAutorUseCase', () => {
  let mongoRepoMock: jest.Mocked<RepositoryInterface>;
  let dynamoRepoMock: jest.Mocked<RepositoryInterface>;

  // Utilizamos o modelo de dados real extraído do arquivo de mock
  const autorCreateBody = {
    nome: 'autor-mock-name',
    totalLivros: 3,
    revisar: true,
  };

  beforeAll(() => {
    // Suprime os logs de erro no console durante os testes
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock dos repositórios específicos
    mongoRepoMock = {
      saveData: jest.fn(),
      getAll: jest.fn(),
      getData: jest.fn(),
      queryData: jest.fn(),
      updateByMinhotecaId: jest.fn(),
      deleteByMinhotecaId: jest.fn(),
      removeData: jest.fn(),
      findByMinhotecaId: jest.fn(),
    } as jest.Mocked<RepositoryInterface>;

    dynamoRepoMock = {
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

  const createEvent = (body: Record<string, unknown> | null): APIGatewayEvent =>
    ({
      body: body ? JSON.stringify(body) : null,
    }) as APIGatewayEvent;

  describe('Cenário: Simulando MongoDB Adapter', () => {
    it('deve criar um autor com sucesso utilizando interface MongoDB', async () => {
      const mockResult: ResultType = { data: {} } as ResultType;
      mongoRepoMock.saveData.mockResolvedValueOnce(mockResult);

      const useCase = new CriarAutorUseCase(mongoRepoMock);
      const event = createEvent(autorCreateBody);
      const result = await useCase.execute(event, '1234567890');

      expect(mongoRepoMock.saveData).toHaveBeenCalledWith(
        'Autores',
        expect.objectContaining({
          nome: autorCreateBody.nome,
          totalLivros: autorCreateBody.totalLivros,
          revisar: autorCreateBody.revisar,
          id: expect.any(String),
        })
      );
      expect(result.Code).toBe(201);
      expect(result.PageData).toEqual([
        expect.objectContaining({
          ...autorCreateBody,
          id: expect.any(String),
        }),
      ]);
    });

    it('deve lançar erro genérico quando o MongoDB estourar um erro (ex: Duplicated Key)', async () => {
      const mongoError = new Error('E11000 duplicate key error collection');
      mongoError.name = 'MongoServerError';
      mongoRepoMock.saveData.mockRejectedValueOnce(mongoError);

      const useCase = new CriarAutorUseCase(mongoRepoMock);
      await expect(
        useCase.execute(createEvent({ nome: autorCreateBody.nome }), '1234567890')
      ).rejects.toThrow('Falha ao criar autor.');
      expect(mongoRepoMock.saveData).toHaveBeenCalled();
    });
  });

  describe('Cenário: Simulando DynamoDB Adapter', () => {
    it('deve criar um autor com sucesso utilizando interface DynamoDB', async () => {
      // DynamoDB Client .put() geralmente retorna uma resposta vazia em caso de sucesso
      const mockResult: ResultType = { data: {} } as ResultType;
      dynamoRepoMock.saveData.mockResolvedValueOnce(mockResult);

      const useCase = new CriarAutorUseCase(dynamoRepoMock);
      const event = createEvent(autorCreateBody);
      const result = await useCase.execute(event, '1234567890');

      expect(dynamoRepoMock.saveData).toHaveBeenCalledWith(
        'Autores',
        expect.objectContaining(autorCreateBody)
      );
      expect(result.Code).toBe(201);
      expect(result.Message).toBe('Autor criado com sucesso');
      expect(result.PageData).toEqual([
        expect.objectContaining({
          ...autorCreateBody,
          id: expect.any(String),
        }),
      ]);
    });

    it('deve lançar erro genérico quando o DynamoDB falhar (ex: ProvisionedThroughput)', async () => {
      const dynamoError = new Error(
        'The level of configured provisioned throughput for the table was exceeded'
      );
      dynamoError.name = 'ProvisionedThroughputExceededException';
      dynamoRepoMock.saveData.mockRejectedValueOnce(dynamoError);

      const useCase = new CriarAutorUseCase(dynamoRepoMock);
      await expect(
        useCase.execute(createEvent({ nome: autorCreateBody.nome }), '1234567890')
      ).rejects.toThrow('Falha ao criar autor.');
    });
  });

  describe('Cenários de borda', () => {
    it('deve falhar ao tratar data.body nulo devido a erro de validação (fallback para objeto vazio)', async () => {
      const spyAdapter = jest.spyOn(AutorAdapter, 'fromCreateDTO');
      const useCase = new CriarAutorUseCase(dynamoRepoMock);
      const event = createEvent(null);

      await expect(useCase.execute(event, '1234567890')).rejects.toThrow('Falha ao criar autor.');
      expect(spyAdapter).toHaveBeenCalledWith({});
    });

    it('deve lançar erro quando houver erro de parsing no JSON (body inválido)', async () => {
      const useCase = new CriarAutorUseCase(mongoRepoMock);
      const event = { body: '{ invalid json' } as APIGatewayEvent;
      await expect(useCase.execute(event, '1234567890')).rejects.toThrow('Falha ao criar autor.');
    });
  });
});
