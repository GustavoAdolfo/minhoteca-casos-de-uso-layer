import { ObterEditoraUseCase } from '../../../layer/nodejs/src/editora/obter-editora';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { Livro, LogService } from '@gustavoadolfo/minhoteca-core-layer';
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

describe('ObterEditoraUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;

  const editoraMockData = {
    id: '1234567890',
    nome: 'editora-mock-name',
    email: 'editora-mock@email.net',
    website: 'http://editora-mock-website.com',
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

  it('deve obter uma editora com sucesso utilizando pathParameters', async () => {
    repoMock.findByMinhotecaId.mockResolvedValueOnce({ data: editoraMockData } as ResultType);
    repoMock.getAll.mockResolvedValueOnce({ data: [] } as ResultType); // Mock para livros

    const useCase = new ObterEditoraUseCase(repoMock);
    const event = createEvent({ id: '1234567890' });

    const result = await useCase.execute(event);

    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Editoras', '1234567890');
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Editora obtida com sucesso.');
    expect(result.PageData).toEqual(
      expect.arrayContaining([expect.objectContaining({ nome: 'editora-mock-name' })])
    );
  });

  it('deve obter uma editora com sucesso utilizando queryStringParameters (fallback de id)', async () => {
    repoMock.findByMinhotecaId.mockResolvedValueOnce({ data: editoraMockData } as ResultType);
    repoMock.getAll.mockResolvedValueOnce({ data: [] } as ResultType); // Mock para livros

    const useCase = new ObterEditoraUseCase(repoMock);
    const event = createEvent(null, { id: '9999' });

    await useCase.execute(event);

    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Editoras', '9999');
  });

  it('deve retornar 404 e usar logger.warn quando o repositório não retornar uma result válida', async () => {
    // Simulando retorno null que aciona a branch `if (result)` false
    repoMock.findByMinhotecaId.mockResolvedValueOnce(null as unknown as ResultType);

    const useCase = new ObterEditoraUseCase(repoMock);
    const event = createEvent({ id: 'nao-existe' });

    const result = await useCase.execute(event);

    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Editoras', 'nao-existe');
    expect(result.Code).toBe(404);
    expect(result.Message).toBe('Editora não encontrada.');
    expect(result.PageData).toEqual([]);
  });

  it('deve lançar erro genérico no log (e retornar falha) quando nenhum ID for informado', async () => {
    const useCase = new ObterEditoraUseCase(repoMock);
    const event = createEvent(null, null);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao obter editora.');
  });

  it('deve lançar erro genérico quando o repositório falhar internamente', async () => {
    repoMock.findByMinhotecaId.mockRejectedValueOnce(new Error('Erro interno no banco de dados'));

    const useCase = new ObterEditoraUseCase(repoMock);
    const event = createEvent({ id: '123' });

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao obter editora.');
    expect(getLogServiceErrorMock()).toHaveBeenCalled();
  });

  it('deve utilizar o nome da tabela das variáveis de ambiente se estiver definida (branch coverage)', async () => {
    const originalEnv = process.env.TABELA_EDITORAS;
    process.env.TABELA_EDITORAS = 'Tabela_Mock_Editora_Obter';

    try {
      repoMock.findByMinhotecaId.mockResolvedValueOnce({ data: editoraMockData } as ResultType);
      repoMock.getAll.mockResolvedValueOnce({ data: [] } as ResultType);
      const useCase = new ObterEditoraUseCase(repoMock);

      await useCase.execute(createEvent({ id: '999' }));
      expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Tabela_Mock_Editora_Obter', '999');
    } finally {
      process.env.TABELA_EDITORAS = originalEnv;
    }
  });
});
