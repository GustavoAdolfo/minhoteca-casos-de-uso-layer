import { ObterAutorUseCase } from '../../../layer/nodejs/src/autor/obter-autor';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { AutorDTO, Livro, LogService } from '@gustavoadolfo/minhoteca-core-layer';
import { APIGatewayEvent } from 'aws-lambda';

// Mock parcial do core-layer (acompanhando o padrão de outros testes)
jest.mock('@gustavoadolfo/minhoteca-core-layer', () => {
  const actual = jest.requireActual('@gustavoadolfo/minhoteca-core-layer');
  return {
    ...actual,
    LogService: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    })),
    LivroAdapter: {
      // O toDTOList recebe entidades Livro e retorna DTOs
      toDTOList: jest.fn((livroEntities: Livro[]) =>
        livroEntities.map((entity) => ({
          id: entity.getId(),
          titulo: entity.titulo,
          subtitulo: entity.subtitulo,
          imagemCapaUrl: entity.imagemCapaUrl,
        }))
      ),
    },
  };
});

describe('ObterAutorUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;

  const autorMockData = {
    id: '1234567890',
    nome: 'autor-mock-name',
    email: 'autor-mock@email.net',
    website: 'http://autor-mock-website.com',
    pais: 'BRA',
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

  const createEvent = (
    pathParameters: Record<string, string> | null = null,
    queryStringParameters: Record<string, string> | null = null
  ): APIGatewayEvent =>
    ({
      pathParameters,
      queryStringParameters,
    }) as unknown as APIGatewayEvent;

  const getLogServiceErrorMock = (): jest.Mock => {
    const logServiceInstance = (LogService as unknown as jest.Mock).mock.results.at(-1)?.value as
      | { error: jest.Mock }
      | undefined;

    if (!logServiceInstance) {
      throw new Error('LogService mock não foi inicializado.');
    }

    return logServiceInstance.error;
  };

  it('deve obter um autor com sucesso utilizando pathParameters', async () => {
    const mockResult: ResultType = {
      data: autorMockData,
    } as ResultType;
    repoMock.findByMinhotecaId.mockResolvedValueOnce(mockResult);
    repoMock.getAll.mockResolvedValueOnce({ data: [] } as ResultType); // Mock para livros

    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent({ id: '1234567890' });

    const result = await useCase.execute(event, 'execucao-123');

    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Autores', '1234567890');
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Autor obtido com sucesso.');
    expect(result.PageData).toEqual(
      expect.arrayContaining([expect.objectContaining({ nome: 'autor-mock-name' })])
    );
  });

  it('deve obter um autor com sucesso utilizando queryStringParameters (fallback de id)', async () => {
    const mockResult: ResultType = {
      data: autorMockData,
    } as ResultType;
    repoMock.findByMinhotecaId.mockResolvedValueOnce(mockResult);
    repoMock.getAll.mockResolvedValueOnce({ data: [] } as ResultType); // Mock para livros

    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent(null, { id: '9999' });

    await useCase.execute(event, 'execucao-123');

    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Autores', '9999');
  });

  it('deve retornar 404 e usar logger.warn quando o repositório não retornar uma result válida', async () => {
    // Simulando retorno null que aciona a branch `if (result)` false
    repoMock.findByMinhotecaId.mockResolvedValueOnce(null as unknown as ResultType);

    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent({ id: 'nao-existe' });

    const result = await useCase.execute(event, 'execucao-123');

    expect(result.Code).toBe(404);
    expect(result.Message).toBe('Autor não encontrado.');
    expect(result.PageData).toEqual([]);
  });

  it('deve lançar erro genérico no log (e retornar falha) quando nenhum ID for informado', async () => {
    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent(null, null);

    await expect(useCase.execute(event, 'execucao-123')).rejects.toThrow('Falha ao obter autor.');
  });

  it('deve lançar erro genérico quando o repositório falhar internamente', async () => {
    repoMock.findByMinhotecaId.mockRejectedValueOnce(new Error('Erro interno no banco de dados'));

    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent({ id: '123' });

    await expect(useCase.execute(event, 'execucao-123')).rejects.toThrow('Falha ao obter autor.');
    expect(getLogServiceErrorMock()).toHaveBeenCalled();
  });

  it('deve utilizar o nome da tabela das variáveis de ambiente se estiver definida (branch coverage)', async () => {
    const originalEnv = process.env.TABELA_AUTORES;
    process.env.TABELA_AUTORES = 'Tabela_Mock_Autor_Obter';

    try {
      repoMock.findByMinhotecaId.mockResolvedValueOnce({ data: autorMockData } as ResultType);
      repoMock.getAll.mockResolvedValueOnce({ data: [] } as ResultType);
      const useCase = new ObterAutorUseCase(repoMock);

      await useCase.execute(createEvent({ id: '999' }), 'execucao-123');
      expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Tabela_Mock_Autor_Obter', '999');
    } finally {
      process.env.TABELA_AUTORES = originalEnv;
    }
  });

  it('deve obter um autor com livros associados quando houver registros na tabela de Livros', async () => {
    const mockLivros: ResultType = {
      data: [
        {
          id: 'livro-1',
          titulo: 'Livro Test 1',
          subtitulo: 'Subtitulo 1',
          imagemCapaUrl: 'http://example.com/capa1.jpg',
          autorId: '1234567890',
          isbn: '1234567890123',
        },
        {
          id: 'livro-2',
          titulo: 'Livro Test 2',
          subtitulo: 'Subtitulo 2',
          imagemCapaUrl: 'http://example.com/capa2.jpg',
          autorId: '1234567890',
          isbn: '9876543210987',
        },
      ],
      limit: 1000,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 2,
      hasNextPage: false,
      hasPrevPage: false,
    };

    repoMock.findByMinhotecaId.mockResolvedValueOnce({ data: autorMockData } as ResultType);
    repoMock.getAll.mockResolvedValueOnce(mockLivros);

    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent({ id: '1234567890' });

    const result = await useCase.execute(event, 'execucao-123');

    expect(repoMock.getAll).toHaveBeenCalledWith('Livros', {
      filterKey: 'autorId',
      filterValue: '1234567890',
      limit: 1000,
    });
    expect(result.Code).toBe(200);
    expect(result.PageData).toEqual([
      expect.objectContaining({
        nome: 'autor-mock-name',
        livros: expect.arrayContaining([
          expect.objectContaining({
            id: 'livro-1',
            titulo: 'Livro Test 1',
            subtitulo: 'Subtitulo 1',
            imagemCapaUrl: 'http://example.com/capa1.jpg',
            // O DTO de Livro retornado pelo ObterAutorUseCase não inclui o ISBN
          }),
          expect.objectContaining({
            id: 'livro-2',
            titulo: 'Livro Test 2',
            subtitulo: 'Subtitulo 2',
            imagemCapaUrl: 'http://example.com/capa2.jpg',
            // O DTO de Livro retornado pelo ObterAutorUseCase não inclui o ISBN
          }),
        ]),
      }),
    ]);
  });

  it('deve obter um autor sem a propriedade livros quando nenhum livro for encontrado', async () => {
    const mockLivrosVazio: ResultType = {
      data: [],
      limit: 1000,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 0,
      hasNextPage: false,
      hasPrevPage: false,
    };

    repoMock.findByMinhotecaId.mockResolvedValueOnce({ data: autorMockData } as ResultType);
    repoMock.getAll.mockResolvedValueOnce(mockLivrosVazio);

    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent({ id: '1234567890' });

    const result = await useCase.execute(event, 'execucao-123');

    expect(repoMock.getAll).toHaveBeenCalledWith('Livros', {
      filterKey: 'autorId',
      filterValue: '1234567890',
      limit: 1000,
    });
    expect(result.Code).toBe(200);
    // Verifica que author foi retornado
    expect(result.PageData?.[0]).toBeDefined();
    expect(result.PageData?.[0]).toHaveProperty('nome', 'autor-mock-name');
    // Verifica que livros é undefined quando não há registros
    expect((result.PageData?.[0] as unknown as AutorDTO).livros).toBeUndefined();
  });
});
