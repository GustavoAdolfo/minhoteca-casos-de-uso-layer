import { CriarLivroUseCase } from '../../../layer/nodejs/src/livro/criar-livro';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { LivroAdapter } from '@gustavoadolfo/minhoteca-core-layer';

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

describe('CriarLivroUseCase', () => {
  let mongoRepoMock: jest.Mocked<RepositoryInterface>;
  let dynamoRepoMock: jest.Mocked<RepositoryInterface>;
  const idExecucao = 'test-execution-id';

  // Utilizamos o modelo de dados real extraído do arquivo de mock
  const livroMockData = {
    id: '1cc97df5bfa64cf9b5ff44734a7e4521',
    titulo: 'Batman e Filho',
    subtitulo: 'A Lenda do Batman - Volume 1',
    isbn: '9788543908366',
    autorId: '9264cb73-1ac9-422c-a07f-26d3ba3af2ed',
    editoraId: 'd98a30cf69ba45e3ac4477877073ad9c',
    anoPublicacao: 2019,
    sinopse:
      "Quando aquela que o Batman um dia amou, Talia, filha de um dos maiores inimidos do Cavaleiro das Trevas, Ra''s Al Ghul, reaparece com um exército de Morcegos-Humanos, ela tem uma outra surpresa para o herói - seu filho. Damian Wayne foi criado com a brutal Liga dos Assassions, e seu ímpeto violento e agressivo ameaça demolir o mundo do Homem-Morcego.",
    status: 'DISPONIVEL',
    revisar: false,
    autor: undefined,
    editora: undefined,
    idioma: 'Português',
    imagemCapaMiniUrl: undefined,
    imagemCapaUrl: '64a8ec23d1a011ed9aae204747fd3490.jpg',
  };

  const livroCreateBody = {
    titulo: livroMockData.titulo,
    subtitulo: livroMockData.subtitulo,
    isbn: livroMockData.isbn,
    autorId: livroMockData.autorId,
    editoraId: livroMockData.editoraId,
    anoPublicacao: livroMockData.anoPublicacao,
    sinopse: livroMockData.sinopse,
    status: livroMockData.status,
    revisar: livroMockData.revisar,
    idioma: livroMockData.idioma,
    imagemCapaUrl: livroMockData.imagemCapaUrl,
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
    it('deve criar um livro com sucesso utilizando interface MongoDB', async () => {
      const mockResult: ResultType = {
        data: { ...livroMockData },
        limit: 1,
        currentPage: 1,
        totalPages: 1,
        totalDocuments: 1,
        hasNextPage: false,
        hasPrevPage: false,
      };
      mongoRepoMock.saveData.mockResolvedValueOnce(mockResult);

      const useCase = new CriarLivroUseCase(mongoRepoMock, idExecucao);
      const event = createEvent(livroCreateBody);
      const result = await useCase.execute(event);

      expect(mongoRepoMock.saveData).toHaveBeenCalledWith(
        'Livros',
        expect.objectContaining({
          titulo: livroCreateBody.titulo,
          subtitulo: livroCreateBody.subtitulo,
          isbn: livroCreateBody.isbn,
          autorId: livroCreateBody.autorId,
          editoraId: livroCreateBody.editoraId,
          anoPublicacao: livroCreateBody.anoPublicacao,
          sinopse: livroCreateBody.sinopse,
          status: livroCreateBody.status,
          id: expect.any(String),
          criadoEm: expect.any(String),
          atualizadoEm: expect.any(String),
          paginas: 0,
        })
      );
      expect(result.Code).toBe(201);
      expect(result.PageData).toEqual([expect.objectContaining(livroCreateBody)]);
    });

    it('deve lançar erro genérico quando o MongoDB estourar um erro (ex: Duplicated Key)', async () => {
      const mongoError = new Error('E11000 duplicate key error collection');
      mongoError.name = 'MongoServerError';
      mongoRepoMock.saveData.mockRejectedValueOnce(mongoError);

      const useCase = new CriarLivroUseCase(mongoRepoMock, idExecucao);
      await expect(useCase.execute(createEvent(livroCreateBody))).rejects.toThrow(
        'Falha ao criar livro.'
      );
      expect(mongoRepoMock.saveData).toHaveBeenCalled();
    });
  });

  describe('Cenário: Simulando DynamoDB Adapter', () => {
    it('deve criar um livro com sucesso utilizando interface DynamoDB', async () => {
      const mockResult: ResultType = {
        data: { ...livroMockData },
        limit: 1,
        currentPage: 1,
        totalPages: 1,
        totalDocuments: 1,
        hasNextPage: false,
        hasPrevPage: false,
      };
      dynamoRepoMock.saveData.mockResolvedValueOnce(mockResult);

      const useCase = new CriarLivroUseCase(dynamoRepoMock, idExecucao);
      const event = createEvent(livroCreateBody);
      const result = await useCase.execute(event);

      expect(dynamoRepoMock.saveData).toHaveBeenCalledWith(
        'Livros',
        expect.objectContaining({
          titulo: livroCreateBody.titulo,
          subtitulo: livroCreateBody.subtitulo,
          isbn: livroCreateBody.isbn,
          autorId: livroCreateBody.autorId,
          editoraId: livroCreateBody.editoraId,
          anoPublicacao: livroCreateBody.anoPublicacao,
          sinopse: livroCreateBody.sinopse,
          status: livroCreateBody.status,
          id: expect.any(String),
          criadoEm: expect.any(String),
          atualizadoEm: expect.any(String),
          paginas: 0,
        })
      );
      expect(result.Code).toBe(201);
      expect(result.Message).toBe('Livro criado com sucesso');
      expect(result.PageData).toEqual([expect.objectContaining(livroCreateBody)]);
    });

    it('deve lançar erro genérico quando o DynamoDB falhar (ex: ProvisionedThroughput)', async () => {
      const dynamoError = new Error(
        'The level of configured provisioned throughput for the table was exceeded'
      );
      dynamoError.name = 'ProvisionedThroughputExceededException';
      dynamoRepoMock.saveData.mockRejectedValueOnce(dynamoError);

      const useCase = new CriarLivroUseCase(dynamoRepoMock, idExecucao);
      await expect(useCase.execute(createEvent(livroCreateBody))).rejects.toThrow(
        'Falha ao criar livro.'
      );
    });
  });

  describe('Cenários de borda', () => {
    it('deve falhar ao tratar data.body nulo devido a erro de validação (fallback para objeto vazio)', async () => {
      const spyAdapter = jest.spyOn(LivroAdapter, 'fromCreateDTO');
      const useCase = new CriarLivroUseCase(dynamoRepoMock, idExecucao);
      const event = createEvent(null);

      await expect(useCase.execute(event)).rejects.toThrow('Falha ao criar livro.');
      expect(spyAdapter).toHaveBeenCalledWith({});
    });

    it('deve lançar erro quando houver erro de parsing no JSON (body inválido)', async () => {
      const useCase = new CriarLivroUseCase(mongoRepoMock, idExecucao);
      const event = { body: '{ invalid json' } as APIGatewayEvent;
      await expect(useCase.execute(event)).rejects.toThrow('Falha ao criar livro.');
    });
  });
});
