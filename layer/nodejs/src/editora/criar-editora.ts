import {
  EditoraDTO,
  EditoraAdapter,
  UseCaseInterface,
  PageDataType,
  LogService,
  EditoraInvalidaError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class CriarEditoraUseCase implements UseCaseInterface {
  private _tableName: string;
  private logService = new LogService('CriarEditoraUseCase');
  /**
   *
   */
  constructor(private _repository: RepositoryInterface) {
    this._tableName = process.env.TABELA_EDITORAS || 'Editoras';
    this.logService.info('🏁 Iniciando caso de uso de criar editora.');
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    try {
      const body = JSON.parse(data.body ?? '{}');
      this.logService.info('Dados recebidos para gravação', { body });

      const entity = EditoraAdapter.fromCreateDTO(body);
      this.logService.info('Dados convertidos para entidade', { entity });

      await this._repository.saveData(this._tableName, JSON.parse(entity.toJSONString()));
      this.logService.info('Editora gravada com sucesso', { entity });
      const editoraDTO: EditoraDTO = EditoraAdapter.toDTO(entity);

      this.logService.info('Dados convertidos para DTO de retorno', { editoraDTO });
      return createResult([editoraDTO], 201, 'Editora criada com sucesso');
    } catch (error) {
      this.logService.error('Erro ao criar editora:', {}, error as Error);
      throw new EditoraInvalidaError('Falha ao criar editora.');
    }
  }
}
